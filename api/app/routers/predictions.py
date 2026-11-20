"""
routers/predictions.py
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from app.audit_logger import log_prediction_event
from app.auth import get_current_user
from app.database import get_conn, get_user_id
from app.ml import calculate_bmi, calculate_clinical_score, get_risk_level, run_inference
from app.runtime_control import get_runtime_control
from app.schemas import PredictionInput, PredictionOutput, SaveHistoryInput
from app.state import state

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])

AI_MESSAGES = {
    "THẤP": "Dựa trên các chỉ số bạn đã nhập, mô hình nghiên cứu ước lượng nguy cơ ở mức thấp. Đây chỉ là thông tin tham khảo và không loại trừ các vấn đề sức khỏe tiềm ẩn. Nếu có triệu chứng bất thường hoặc lo ngại, bạn nên trao đổi với bác sĩ.",
    "TRUNG BÌNH": "Dựa trên các chỉ số bạn đã nhập, mô hình nghiên cứu ước lượng nguy cơ ở mức trung bình. Hãy tiếp tục duy trì lối sống lành mạnh và theo dõi định kỳ.",
    "CAO": "Dựa trên dữ liệu nhập vào, mô hình ước lượng nguy cơ ở mức cao. Đây là kết quả tham khảo từ mô hình nghiên cứu, không phải kết luận y khoa. Bạn nên cân nhắc trao đổi sớm với bác sĩ chuyên khoa để được đánh giá đầy đủ.",
    "RẤT CAO": "Dựa trên dữ liệu nhập vào, mô hình ước lượng nguy cơ ở mức rất cao. Đây không phải kết luận y khoa; bạn nên sớm trao đổi với bác sĩ chuyên khoa. Nếu đang có triệu chứng như đau ngực, khó thở hoặc ngất, hãy gọi cấp cứu 115 ngay.",
}

CLINICAL_MESSAGES = {
    "THẤP": "Điểm tham khảo lâm sàng hiện ở mức thấp theo các chỉ số đã nhập. Các chỉ số đơn lẻ không phản ánh toàn bộ tình trạng sức khỏe tổng thể.",
    "TRUNG BÌNH": "Điểm tham khảo lâm sàng ở mức trung bình. Bạn có thể theo dõi định kỳ các chỉ số huyết áp, mỡ máu và trao đổi thêm với bác sĩ khi cần.",
    "CAO": "Điểm tham khảo lâm sàng ở mức cao theo các chỉ số đã nhập. Đây là tín hiệu tham khảo để bạn cân nhắc trao đổi sớm với bác sĩ và xem xét thói quen sinh hoạt phù hợp.",
    "RẤT CAO": "Điểm tham khảo lâm sàng ở mức rất cao theo các chỉ số đã nhập. Đây là tín hiệu tham khảo để bạn cân nhắc trao đổi sớm với bác sĩ và xem xét thói quen sinh hoạt phù hợp.",
}


def _parse_inputs(raw_inputs):
    if isinstance(raw_inputs, (str, bytes)):
        try:
            return json.loads(raw_inputs)
        except Exception:
            return None
    return raw_inputs


@router.post("/predict", response_model=PredictionOutput)
def predict(input_data: PredictionInput, current_user: str = Depends(get_current_user)):
    """Dự đoán nguy cơ bệnh tim mạch dùng Pipeline Học Máy v2."""
    if get_runtime_control().get("prediction_disabled"):
        raise HTTPException(
            status_code=503,
            detail="Tính năng ước lượng nguy cơ hiện đang tạm dừng bảo trì bởi quản trị viên.",
        )
    if state.pipeline_v2 is None or state.model_card is None:
        raise HTTPException(status_code=503, detail="Mô hình ML v2 chưa sẵn sàng")

    d = input_data.model_dump()
    bmi_value = calculate_bmi(d.get("height"), d.get("weight")) if d.get("include_bmi") else None

    prediction_result, probability = run_inference(state.pipeline_v2, state.model_card, d)
    clinical_score = calculate_clinical_score(d)

    ai_risk_level = get_risk_level(probability, state.model_card.get("risk_bands"))
    clinical_risk_level = get_risk_level(clinical_score)

    response_payload = {
        "ai_prediction": {
            "probability": float(probability),
            "risk_level": ai_risk_level,
            "message": AI_MESSAGES[ai_risk_level],
        },
        "clinical_evaluation": {
            "probability": float(clinical_score),
            "risk_level": clinical_risk_level,
            "message": CLINICAL_MESSAGES[clinical_risk_level],
        },
        "prediction": int(prediction_result),
        "bmi": bmi_value,
    }
    log_prediction_event(
        current_user,
        "predict",
        {"inputs": d, "result": response_payload},
    )
    return response_payload


@router.get("/prediction/history")
def get_prediction_history(
    response: Response,
    current_user: str = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
    q: str = Query("", max_length=100),
):
    """Lấy danh sách lịch sử chẩn đoán bệnh của cá nhân user."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        response.headers["Cache-Control"] = "private, no-store"
        user_id = get_user_id(cursor, current_user)
        search = ""
        params = [user_id]
        if q.strip():
            search = " AND (LOCATE(LOWER(%s), LOWER(name_prediction)) > 0 OR LOCATE(LOWER(%s), LOWER(risk_level)) > 0)"
            params.extend([q.strip(), q.strip()])
        params.extend([limit, offset])
        cursor.execute(
            """SELECT id, name_prediction, prediction_result, risk_level, timestamp,
                      clinical_score, probability, inputs_json
               FROM prediction_history WHERE user_id = %s""" + search +
            " ORDER BY timestamp DESC, id DESC LIMIT %s OFFSET %s",
            tuple(params),
        )
        rows = cursor.fetchall()
        return [
            {
                "id":                r[0],
                "name_prediction":   r[1],
                "prediction_result": r[2],
                "risk_level":        r[3],
                "timestamp":         r[4].isoformat() if r[4] else None,
                "clinical_score":    r[5] if len(r) > 5 else None,
                "probability":       r[6] if len(r) > 6 else None,
                "inputs":            _parse_inputs(r[7]) if len(r) > 7 else None,
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception:
        logger.exception("Lỗi lấy lịch sử dự đoán")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải lịch sử")
    finally:
        cursor.close()
        conn.close()


@router.get("/prediction/history/{record_id}")
def get_prediction_history_detail(
    record_id: int,
    response: Response,
    current_user: str = Depends(get_current_user),
):
    """Lấy chi tiết một lần chẩn đoán (kèm các chỉ số đầu vào đã lưu)."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        response.headers["Cache-Control"] = "private, no-store"
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            """SELECT id, name_prediction, prediction_result, risk_level, timestamp,
                      clinical_score, probability, inputs_json
               FROM prediction_history WHERE id = %s AND user_id = %s LIMIT 1""",
            (record_id, user_id),
        )
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi lịch sử")
        return {
            "id":                r[0],
            "name_prediction":   r[1],
            "prediction_result": r[2],
            "risk_level":        r[3],
            "timestamp":         r[4].isoformat() if r[4] else None,
            "clinical_score":    r[5] if len(r) > 5 else None,
            "probability":       r[6] if len(r) > 6 else None,
            "inputs":            _parse_inputs(r[7]) if len(r) > 7 else None,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Lỗi lấy chi tiết lịch sử dự đoán")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải chi tiết lịch sử")
    finally:
        cursor.close()
        conn.close()


@router.post("/prediction/history")
def save_prediction_history(body: SaveHistoryInput, current_user: str = Depends(get_current_user)):
    """Lưu kết quả dự đoán vào cơ sở dữ liệu."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        inputs_str = json.dumps(body.inputs, ensure_ascii=False) if body.inputs is not None else None
        cursor.execute(
            """INSERT INTO prediction_history
               (user_id, username, name_prediction, prediction_result, clinical_score, probability, risk_level, inputs_json)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (user_id, current_user, body.name_prediction, body.prediction_result,
             body.clinical_score, body.probability, body.risk_level, inputs_str),
        )
        conn.commit()
        log_prediction_event(
            current_user,
            "save_history",
            {
                "name_prediction": body.name_prediction,
                "prediction_result": body.prediction_result,
                "clinical_score": body.clinical_score,
                "probability": body.probability,
                "risk_level": body.risk_level,
                "inputs": body.inputs,
            },
        )
        return {"status": "success", "message": "Đã lưu lịch sử đánh giá tham khảo thành công!"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Lỗi lưu lịch sử đánh giá tham khảo")
        raise HTTPException(status_code=500, detail="Không thể lưu kết quả đánh giá tham khảo vào cơ sở dữ liệu")
    finally:
        cursor.close()
        conn.close()
