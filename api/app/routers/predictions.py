"""
routers/predictions.py
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from app.auth import get_current_user
from app.database import get_conn, get_user_id
from app.ml import build_feature_dict, calculate_bmi, calculate_clinical_score, get_risk_level, run_inference
from app.schemas import PredictionInput, PredictionOutput, SaveHistoryInput
from app.state import state  # <-- Đã nạp biến state chuẩn chỉnh

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])

@router.post("/predict", response_model=PredictionOutput)
def predict(input_data: PredictionInput, current_user: str = Depends(get_current_user)):
    """Dự đoán nguy cơ bệnh tim mạch dùng mô hình Học Máy."""
    if state.model is None:
        raise HTTPException(status_code=503, detail="Mô hình ML chưa sẵn sàng")
        
    if state.feature_names is None:
        raise HTTPException(status_code=503, detail="Danh sách đặc trưng trong State chưa được nạp từ file cấu hình")

    d = input_data.model_dump()
    bmi_value = calculate_bmi(d.get("height"), d.get("weight")) if d.get("include_bmi") else None

    # Đồng bộ chuẩn xác sang state.feature_names
    features_dict = build_feature_dict(d, bmi_value, state.feature_names)
    
    # Chạy mô hình suy luận AI dựa trên feature_names
    prediction_result, probability = run_inference(state.model, state.scaler, features_dict, state.feature_names)
    clinical_score = calculate_clinical_score(d)
    risk_level = get_risk_level(probability)

    # Tự động sinh thông điệp tư vấn dựa theo mức độ nguy cơ để hiển thị lên giao diện React
    if risk_level == "THẤP":
        ai_message = "Tuyệt vời! Hệ thống đánh giá nguy cơ tim mạch của bạn ở mức THẤP (An toàn)."
        clinical_message = "Các chỉ số lâm sàng hiện tại đang rất ổn định. Hãy tiếp tục duy trì phong độ này!"
    elif risk_level == "TRUNG BÌNH":
        ai_message = "Nguy cơ tim mạch ở mức TRUNG BÌNH. Hãy chú ý duy trì lối sống lành mạnh và theo dõi định kỳ."
        clinical_message = "Các chỉ số ở ngưỡng nhạy cảm, cần hạn chế căng thẳng và tập thể dục đều đặn hơn."
    elif risk_level == "CAO":
        ai_message = "Hệ thống phát hiện nguy cơ tim mạch ở mức CAO. Bạn nên đến gặp bác sĩ chuyên khoa sớm để kiểm tra."
        clinical_message = "Điểm lâm sàng cảnh báo dấu hiệu không tốt. Hãy chú ý chế độ ăn uống bớt muối và mỡ động vật."
    else:
        ai_message = "CẢNH BÁO: Nguy cơ tim mạch ở mức RẤT CAO! Cần đến cơ sở y tế gần nhất để kiểm tra chuyên sâu ngay lập tức."
        clinical_message = "Điểm số lâm sàng ở mức báo động đỏ. Cần can thiệp y tế và theo dõi nghiêm ngặt."

    # Trả về cấu trúc lồng ghép (Nested Object) khớp hoàn chỉnh với Interface của Front-end
    return {
        "ai_prediction": {
            "probability": float(probability),
            "risk_level": risk_level,
            "message": ai_message
        },
        "clinical_evaluation": {
            "probability": float(clinical_score) / 10.0 if clinical_score > 1 else float(clinical_score),
            "risk_level": risk_level,
            "message": clinical_message
        },
        "prediction": int(prediction_result),
        "bmi": bmi_value
    }


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
            """SELECT id, name_prediction, prediction_result, risk_level, timestamp 
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


@router.post("/prediction/history")
def save_prediction_history(body: SaveHistoryInput, current_user: str = Depends(get_current_user)):
    """Lưu kết quả dự đoán vào cơ sở dữ liệu."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            """INSERT INTO prediction_history
               (user_id, username, name_prediction, prediction_result, clinical_score, probability, risk_level)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (user_id, current_user, body.name_prediction, body.prediction_result,
             body.clinical_score, body.probability, body.risk_level),
        )
        conn.commit()
        return {"status": "success", "message": "Đã lưu lịch sử chẩn đoán thành công!"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Lỗi lưu lịch sử chẩn đoán")
        raise HTTPException(status_code=500, detail="Không thể lưu kết quả chẩn đoán")
    finally:
        cursor.close()
        conn.close()
