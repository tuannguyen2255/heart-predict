"""
admin_server.py — Trung tâm Quản trị & Giám sát An toàn HeartGuard (Localhost-Only Admin System).
Chạy độc lập tại http://127.0.0.1:8090, kết nối trực tiếp tới MySQL + thư mục logs/ + runtime_control.json.
"""
import asyncio
from contextlib import asynccontextmanager
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from mysql.connector.pooling import MySQLConnectionPool
from pydantic import BaseModel, Field

# Thêm thư mục api/ vào sys.path để dùng chung config, database, audit_logger, runtime_control
PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_DIR = PROJECT_ROOT / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.audit_logger import (  # noqa: E402
    DELETION_REQUEST_LOG_DIR,
    GUARDRAIL_LOG_DIR,
    LOGIN_LOG_DIR,
    PREDICTION_USER_LOG_DIR,
    USER_LOG_DIR,
    delete_user_logs,
    log_deletion_request_event,
    log_user_event,
)
from app.auth import create_token  # noqa: E402
from app.config import (  # noqa: E402
    CURRENT_TERMS_VERSION,
    DB_CONFIG,
    GROQ_API_KEY,
    GROQ_MODEL,
    JWT_ALGORITHM,
    JWT_SECRET,
    MODEL_CARD_V2_PATH,
)
from app.database import init_db  # noqa: E402
from app.runtime_control import get_runtime_control, update_runtime_control  # noqa: E402
from app.state import state  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s | [ADMIN] %(levelname)s | %(message)s")
logger = logging.getLogger("heartguard.admin")

ADMIN_DIR = Path(__file__).resolve().parent
STATIC_DIR = ADMIN_DIR / "static"
TEMPLATES_DIR = ADMIN_DIR / "templates"
DEFAULT_OWNER_USERNAME = os.getenv("ADMIN_USERNAME", "tuannguyen2205")
ADMIN_PORT = int(os.getenv("ADMIN_PORT", "8090"))

security = HTTPBearer(auto_error=False)


# ── Pydantic Schemas ─────────────────────────────────────────────────────────
class AdminLoginInput(BaseModel):
    username: str
    password: str


class DeletionDecisionInput(BaseModel):
    note: Optional[str] = Field(default="", max_length=500)


class RoleUpdateInput(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


class RuntimeControlPatch(BaseModel):
    chatbot_disabled: Optional[bool] = None
    registration_disabled: Optional[bool] = None
    prediction_disabled: Optional[bool] = None
    hourly_chat_limit: Optional[int] = Field(default=None, ge=1, le=200)
    max_pilot_users: Optional[int] = Field(default=None, ge=0, le=10000)
    auto_purge_24h_deletions: Optional[bool] = None
    pilot_notice: Optional[str] = Field(default=None, max_length=300)


# ── Database Helpers ─────────────────────────────────────────────────────────
def get_admin_conn():
    if state.db_pool is None:
        state.db_pool = MySQLConnectionPool(pool_name="admin_pool", pool_size=5, **DB_CONFIG)
    return state.db_pool.get_connection()


def ensure_owner_admin():
    """Đảm bảo tài khoản chủ dự án (tuannguyen2205) luôn có role='admin'."""
    conn = get_admin_conn()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET role = 'admin' WHERE username = %s", (DEFAULT_OWNER_USERNAME,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def execute_account_deletion(user_id: int, username: str, reason: str, deleted_by: str, note: str = "") -> None:
    """Xóa hoàn toàn tài khoản khỏi MySQL (cascade) + xóa file log JSON cá nhân + ghi biên bản xóa."""
    conn = get_admin_conn()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    delete_user_logs(username)
    log_deletion_request_event(
        username,
        action="approved_and_deleted",
        reason=f"{reason} | Duyệt bởi: {deleted_by}" + (f" ({note})" if note else ""),
    )


def purge_overdue_24h_requests(triggered_by: str = "auto_scheduler") -> List[Dict[str, Any]]:
    """Tìm và xóa toàn bộ tài khoản có yêu cầu xóa pending đã quá hạn 24 giờ."""
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    overdue_rows = []
    try:
        cur.execute(
            "SELECT id, user_id, username, reason, requested_at, scheduled_delete_at "
            "FROM account_deletion_requests "
            "WHERE status = 'pending' AND scheduled_delete_at <= NOW()"
        )
        overdue_rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    purged = []
    for row in overdue_rows:
        execute_account_deletion(
            user_id=row["user_id"],
            username=row["username"],
            reason=row["reason"],
            deleted_by=triggered_by,
            note="Tự động xóa theo cam kết 24 giờ",
        )
        purged.append({"request_id": row["id"], "username": row["username"], "reason": row["reason"]})
    return purged


async def _auto_purge_loop():
    """Tác vụ nền kiểm tra mỗi 5 phút để tự động xóa các yêu cầu đã qua 24h."""
    while True:
        try:
            await asyncio.sleep(300)
            if get_runtime_control().get("auto_purge_24h_deletions", True):
                purged = purge_overdue_24h_requests(triggered_by="auto_24h_daemon")
                if purged:
                    logger.info("Auto-purged %d overdue 24h deletion requests: %s", len(purged), purged)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Auto-purge loop warning: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Khởi động HeartGuard Admin System tại http://127.0.0.1:%d ...", ADMIN_PORT)
    state.db_pool = MySQLConnectionPool(pool_name="admin_pool", pool_size=6, **DB_CONFIG)
    init_db()
    ensure_owner_admin()
    if os.path.exists(MODEL_CARD_V2_PATH):
        try:
            with open(MODEL_CARD_V2_PATH, "r", encoding="utf-8") as f:
                state.model_card = json.load(f)
        except Exception:
            state.model_card = {}
    task = asyncio.create_task(_auto_purge_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="HeartGuard Admin Control Center",
    description="Hệ thống quản trị nội bộ (Localhost-Only) cho đợt thử nghiệm Pilot HeartGuard",
    version="1.0.0",
    lifespan=lifespan,
)

STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Localhost-Only Security Middleware ───────────────────────────────────────
@app.middleware("http")
async def enforce_localhost_only(request: Request, call_next):
    client_host = (request.client.host if request.client else "").lower()
    allowed_hosts = {"127.0.0.1", "::1", "localhost", "testclient"}
    if client_host not in allowed_hosts:
        return JSONResponse(
            status_code=403,
            content={"detail": "Truy cập bị từ chối: Hệ thống Admin chỉ cho phép truy cập trực tiếp trên máy chủ nội bộ (127.0.0.1)."},
        )
    return await call_next(request)


# ── Admin Auth Dependency ────────────────────────────────────────────────────
def get_current_admin(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập quyền Quản trị viên.")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        if not username or role != "admin":
            raise HTTPException(status_code=403, detail="Tài khoản không có quyền Quản trị viên (admin).")
        return username
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Phiên quản trị đã hết hạn, vui lòng đăng nhập lại.") from exc


# ── UI Entrypoint ────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def serve_admin_ui():
    index_file = TEMPLATES_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Missing templates/index.html</h1>", status_code=500)
    return FileResponse(str(index_file))


# ── Auth Endpoints ───────────────────────────────────────────────────────────
@app.post("/api/admin/login")
def admin_login(body: AdminLoginInput):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, username, password, role FROM users WHERE username = %s LIMIT 1",
            (body.username.strip(),),
        )
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(body.password.encode("utf-8"), user["password"].encode("utf-8")):
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng.")
        if user["role"] != "admin" and user["username"] != DEFAULT_OWNER_USERNAME:
            raise HTTPException(status_code=403, detail="Tài khoản này không có quyền Quản trị viên (admin).")
        if user["role"] != "admin":
            cur.execute("UPDATE users SET role = 'admin' WHERE id = %s", (user["id"],))
            conn.commit()
        token = create_token(user["username"], role="admin")
        return {"access_token": token, "username": user["username"], "role": "admin"}
    finally:
        cur.close()
        conn.close()


@app.post("/api/admin/local-unlock")
def admin_local_unlock(request: Request):
    """Mở nhanh phiên quản trị trên máy chủ local (127.0.0.1) cho chủ dự án."""
    client_host = (request.client.host if request.client else "").lower()
    if client_host not in {"127.0.0.1", "::1", "localhost", "testclient"}:
        raise HTTPException(status_code=403, detail="Chỉ khả dụng trực tiếp trên localhost.")
    ensure_owner_admin()
    token = create_token(DEFAULT_OWNER_USERNAME, role="admin")
    return {"access_token": token, "username": DEFAULT_OWNER_USERNAME, "role": "admin"}


# ── 1. Executive Overview & Pilot Funnel ─────────────────────────────────────
def _read_json_list(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


@app.get("/api/admin/overview")
def get_overview(admin_user: str = Depends(get_current_admin)):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT COUNT(*) AS c FROM users")
        total_users = cur.fetchone()["c"]

        cur.execute(
            "SELECT COUNT(*) AS c FROM users WHERE terms_version = %s AND age_confirmed = 1",
            (CURRENT_TERMS_VERSION,),
        )
        consented_users = cur.fetchone()["c"]

        cur.execute(
            "SELECT COUNT(*) AS c FROM user_information "
            "WHERE age IS NOT NULL OR height IS NOT NULL OR blood_pressure IS NOT NULL"
        )
        profiled_users = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS uniq FROM prediction_history")
        pred_row = cur.fetchone()
        total_predictions = pred_row["total"]
        users_with_pred = pred_row["uniq"]

        cur.execute(
            "SELECT COUNT(*) AS c FROM ("
            "  SELECT user_id FROM prediction_history GROUP BY user_id HAVING COUNT(*) >= 2"
            ") t"
        )
        repeat_pred_users = cur.fetchone()["c"]

        cur.execute(
            "SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS uniq "
            "FROM chatbot_history WHERE role = 'user'"
        )
        chat_row = cur.fetchone()
        total_user_chats = chat_row["total"]
        users_with_chat = chat_row["uniq"]

        cur.execute("SELECT risk_level, COUNT(*) AS count FROM prediction_history GROUP BY risk_level")
        risk_rows = cur.fetchall()
        risk_dist = {"THẤP": 0, "TRUNG BÌNH": 0, "CAO": 0, "RẤT CAO": 0}
        for r in risk_rows:
            lvl = (r["risk_level"] or "").upper()
            if lvl in risk_dist:
                risk_dist[lvl] = r["count"]

        cur.execute(
            "SELECT COUNT(*) AS pending, "
            "SUM(CASE WHEN scheduled_delete_at <= NOW() THEN 1 ELSE 0 END) AS overdue "
            "FROM account_deletion_requests WHERE status = 'pending'"
        )
        del_row = cur.fetchone()
        pending_deletions = del_row["pending"] or 0
        overdue_deletions = int(del_row["overdue"] or 0)
    finally:
        cur.close()
        conn.close()

    # Đếm log guardrail & login hôm nay
    today_str = datetime.now().strftime("%Y-%m-%d")
    guardrail_today = _read_json_list(GUARDRAIL_LOG_DIR / f"guardrail_{today_str}.json")
    login_today = _read_json_list(LOGIN_LOG_DIR / f"login_{today_str}.json")
    failed_logins_today = sum(1 for x in login_today if x.get("status") == "failed")

    total_guardrail_all = 0
    if GUARDRAIL_LOG_DIR.exists():
        for gf in GUARDRAIL_LOG_DIR.glob("guardrail_*.json"):
            total_guardrail_all += len(_read_json_list(gf))

    ctrl = get_runtime_control()
    max_pilot = int(ctrl.get("max_pilot_users") or 100)

    funnel = [
        {"stage": "1. Đăng ký tài khoản", "count": total_users, "pct": 100.0 if total_users else 0.0},
        {
            "stage": f"2. Đồng ý Điều khoản ({CURRENT_TERMS_VERSION})",
            "count": consented_users,
            "pct": round(consented_users * 100.0 / total_users, 1) if total_users else 0.0,
        },
        {
            "stage": "3. Cập nhật Hồ sơ sức khỏe",
            "count": profiled_users,
            "pct": round(profiled_users * 100.0 / total_users, 1) if total_users else 0.0,
        },
        {
            "stage": "4. Lưu kết quả Đánh giá (≥ 1 lần)",
            "count": users_with_pred,
            "pct": round(users_with_pred * 100.0 / total_users, 1) if total_users else 0.0,
        },
        {
            "stage": "5. Hỏi Trợ lý AI Chatbot (≥ 1 câu)",
            "count": users_with_chat,
            "pct": round(users_with_chat * 100.0 / total_users, 1) if total_users else 0.0,
        },
        {
            "stage": "6. Quay lại đánh giá lần 2+",
            "count": repeat_pred_users,
            "pct": round(repeat_pred_users * 100.0 / total_users, 1) if total_users else 0.0,
        },
    ]

    return {
        "kpis": {
            "total_users": total_users,
            "max_pilot_users": max_pilot,
            "consented_users": consented_users,
            "total_predictions": total_predictions,
            "total_user_chats": total_user_chats,
            "pending_deletions": pending_deletions,
            "overdue_deletions": overdue_deletions,
            "guardrail_blocks_today": len(guardrail_today),
            "guardrail_blocks_total": total_guardrail_all,
            "failed_logins_today": failed_logins_today,
            "logins_today": len(login_today),
        },
        "funnel": funnel,
        "risk_distribution": risk_dist,
        "runtime_control": ctrl,
        "system_info": {
            "current_terms_version": CURRENT_TERMS_VERSION,
            "groq_configured": bool(GROQ_API_KEY and GROQ_API_KEY.startswith("gsk_")),
            "groq_model": GROQ_MODEL,
            "ml_model": (state.model_card or {}).get("model", "RandomForest / Pipeline v2"),
            "ml_threshold": (state.model_card or {}).get("threshold", 0.5),
        },
    }


# ── 2. 24-Hour Deletion Request Queue ────────────────────────────────────────
@app.get("/api/admin/deletion-requests")
def list_deletion_requests(admin_user: str = Depends(get_current_admin)):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """
            SELECT r.id, r.user_id, r.username, r.reason, r.status,
                   r.requested_at, r.scheduled_delete_at,
                   TIMESTAMPDIFF(MINUTE, NOW(), r.scheduled_delete_at) AS minutes_remaining,
                   u.email, u.terms_version,
                   (SELECT COUNT(*) FROM prediction_history p WHERE p.user_id = r.user_id) AS prediction_count,
                   (SELECT COUNT(*) FROM chatbot_history c WHERE c.user_id = r.user_id AND c.role = 'user') AS chat_count
            FROM account_deletion_requests r
            LEFT JOIN users u ON u.id = r.user_id
            ORDER BY FIELD(r.status, 'pending', 'cancelled', 'approved'), r.scheduled_delete_at ASC
            """
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    items = []
    for r in rows:
        mins = r["minutes_remaining"] if r["minutes_remaining"] is not None else 0
        items.append(
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "username": r["username"],
                "email": r["email"],
                "terms_version": r["terms_version"],
                "reason": r["reason"],
                "status": r["status"],
                "requested_at": r["requested_at"].isoformat() if r["requested_at"] else None,
                "scheduled_delete_at": r["scheduled_delete_at"].isoformat() if r["scheduled_delete_at"] else None,
                "minutes_remaining": mins,
                "hours_remaining": round(mins / 60.0, 1),
                "is_overdue": bool(r["status"] == "pending" and mins <= 0),
                "prediction_count": r["prediction_count"] or 0,
                "chat_count": r["chat_count"] or 0,
            }
        )

    audit_history = _read_json_list(DELETION_REQUEST_LOG_DIR / "deletion_requests.json")
    return {"requests": items, "audit_history": list(reversed(audit_history[-50:]))}


@app.post("/api/admin/deletion-requests/{req_id}/approve")
def approve_deletion_request(
    req_id: int,
    body: DeletionDecisionInput,
    admin_user: str = Depends(get_current_admin),
):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, user_id, username, reason, status FROM account_deletion_requests WHERE id = %s LIMIT 1",
            (req_id,),
        )
        req = cur.fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa này.")
    finally:
        cur.close()
        conn.close()

    execute_account_deletion(
        user_id=req["user_id"],
        username=req["username"],
        reason=req["reason"],
        deleted_by=admin_user,
        note=body.note or "Duyệt xóa thủ công trên Admin",
    )
    return {
        "status": "deleted",
        "username": req["username"],
        "message": f"Đã xóa vĩnh viễn tài khoản '{req['username']}' cùng toàn bộ dữ liệu MySQL và file log cá nhân.",
    }


@app.post("/api/admin/deletion-requests/{req_id}/reject")
def reject_deletion_request(
    req_id: int,
    body: DeletionDecisionInput,
    admin_user: str = Depends(get_current_admin),
):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, user_id, username, reason FROM account_deletion_requests WHERE id = %s LIMIT 1",
            (req_id,),
        )
        req = cur.fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu xóa này.")
        cur.execute("UPDATE account_deletion_requests SET status = 'cancelled' WHERE id = %s", (req_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    note_str = body.note or "Quản trị viên tạm giữ/từ chối yêu cầu"
    log_deletion_request_event(req["username"], action="rejected_by_admin", reason=f"{req['reason']} | Ghi chú: {note_str}")
    log_user_event(req["username"], "deletion_rejected_by_admin", {"note": note_str, "admin": admin_user})
    return {"status": "cancelled", "message": f"Đã chuyển yêu cầu xóa của '{req['username']}' sang trạng thái hủy/tạm giữ."}


@app.post("/api/admin/deletion-requests/auto-purge")
def trigger_auto_purge(admin_user: str = Depends(get_current_admin)):
    purged = purge_overdue_24h_requests(triggered_by=f"admin:{admin_user}")
    return {
        "purged_count": len(purged),
        "purged": purged,
        "message": (
            f"Đã tự động duyệt và xóa {len(purged)} tài khoản quá hạn 24 giờ."
            if purged
            else "Hiện chưa có yêu cầu xóa nào vượt quá mốc 24 giờ."
        ),
    }


# ── 3. Users & Legal Consent Audit ───────────────────────────────────────────
@app.get("/api/admin/users")
def list_users(
    q: str = Query("", max_length=100),
    admin_user: str = Depends(get_current_admin),
):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        sql = """
            SELECT u.id, u.username, u.email, u.phone, u.role,
                   u.terms_version, u.accepted_terms_at, u.age_confirmed, u.research_consent, u.created_at,
                   ui.age, ui.sex, ui.height, ui.weight, ui.blood_pressure, ui.cholesterol,
                   (SELECT COUNT(*) FROM prediction_history p WHERE p.user_id = u.id) AS prediction_count,
                   (SELECT COUNT(*) FROM chatbot_history c WHERE c.user_id = u.id AND c.role = 'user') AS chat_count,
                   (SELECT COUNT(*) FROM account_deletion_requests r WHERE r.user_id = u.id AND r.status = 'pending') AS pending_deletion
            FROM users u
            LEFT JOIN user_information ui ON ui.user_id = u.id
        """
        params: tuple = ()
        if q.strip():
            like = f"%{q.strip()}%"
            sql += " WHERE u.username LIKE %s OR u.email LIKE %s OR u.phone LIKE %s"
            params = (like, like, like)
        sql += " ORDER BY u.id DESC LIMIT 250"
        cur.execute(sql, params)
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    users = []
    for r in rows:
        users.append(
            {
                "id": r["id"],
                "username": r["username"],
                "email": r["email"],
                "phone": r["phone"],
                "role": r["role"],
                "terms_version": r["terms_version"],
                "accepted_terms_at": r["accepted_terms_at"].isoformat() if r["accepted_terms_at"] else None,
                "age_confirmed": bool(r["age_confirmed"]),
                "research_consent": bool(r["research_consent"]),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "profile": {
                    "age": r["age"],
                    "sex": r["sex"],
                    "height": r["height"],
                    "weight": r["weight"],
                    "blood_pressure": r["blood_pressure"],
                    "cholesterol": r["cholesterol"],
                },
                "prediction_count": r["prediction_count"] or 0,
                "chat_count": r["chat_count"] or 0,
                "pending_deletion": bool(r["pending_deletion"]),
            }
        )
    return {"users": users, "current_terms_version": CURRENT_TERMS_VERSION}


@app.get("/api/admin/users/{user_id}/detail")
def get_user_detail(user_id: int, admin_user: str = Depends(get_current_admin)):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, username, email, phone, role, terms_version, accepted_terms_at, "
            "age_confirmed, research_consent, created_at FROM users WHERE id = %s LIMIT 1",
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

        cur.execute(
            "SELECT age, sex, height, weight, blood_pressure, cholesterol, updated_at "
            "FROM user_information WHERE user_id = %s LIMIT 1",
            (user_id,),
        )
        profile = cur.fetchone() or {}

        cur.execute(
            "SELECT id, name_prediction, prediction_result, clinical_score, probability, risk_level, inputs_json, timestamp "
            "FROM prediction_history WHERE user_id = %s ORDER BY id DESC LIMIT 30",
            (user_id,),
        )
        preds = []
        for p in cur.fetchall():
            parsed_inputs = None
            if p["inputs_json"]:
                try:
                    parsed_inputs = json.loads(p["inputs_json"]) if isinstance(p["inputs_json"], str) else p["inputs_json"]
                except Exception:
                    parsed_inputs = p["inputs_json"]
            preds.append(
                {
                    "id": p["id"],
                    "name_prediction": p["name_prediction"],
                    "prediction_result": p["prediction_result"],
                    "clinical_score": p["clinical_score"],
                    "probability": p["probability"],
                    "risk_level": p["risk_level"],
                    "inputs": parsed_inputs,
                    "timestamp": p["timestamp"].isoformat() if p["timestamp"] else None,
                }
            )

        cur.execute(
            "SELECT id, role, content, timestamp FROM chatbot_history WHERE user_id = %s ORDER BY id DESC LIMIT 40",
            (user_id,),
        )
        chats = [
            {
                "id": c["id"],
                "role": c["role"],
                "content": c["content"],
                "timestamp": c["timestamp"].isoformat() if c["timestamp"] else None,
            }
            for c in reversed(cur.fetchall())
        ]
    finally:
        cur.close()
        conn.close()

    uname = user["username"]
    pred_json_logs = _read_json_list(PREDICTION_USER_LOG_DIR / f"{uname}.json")
    user_json_logs = _read_json_list(USER_LOG_DIR / f"{uname}.json")

    return {
        "user": {
            **user,
            "accepted_terms_at": user["accepted_terms_at"].isoformat() if user["accepted_terms_at"] else None,
            "created_at": user["created_at"].isoformat() if user["created_at"] else None,
            "age_confirmed": bool(user["age_confirmed"]),
            "research_consent": bool(user["research_consent"]),
        },
        "profile": {
            **profile,
            "updated_at": profile.get("updated_at").isoformat() if profile.get("updated_at") else None,
        },
        "predictions": preds,
        "chats": chats,
        "json_logs": {
            "prediction_with_users": pred_json_logs[-20:],
            "user_lifecycle": user_json_logs[-20:],
        },
    }


@app.patch("/api/admin/users/{user_id}/role")
def change_user_role(user_id: int, body: RoleUpdateInput, admin_user: str = Depends(get_current_admin)):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT username FROM users WHERE id = %s LIMIT 1", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
        if row["username"] == DEFAULT_OWNER_USERNAME and body.role != "admin":
            raise HTTPException(status_code=400, detail="Không thể hạ quyền của tài khoản chủ dự án.")
        cur.execute("UPDATE users SET role = %s WHERE id = %s", (body.role, user_id))
        conn.commit()
        return {"status": "success", "username": row["username"], "role": body.role}
    finally:
        cur.close()
        conn.close()


@app.post("/api/admin/users/{user_id}/reset-chat-quota")
def reset_user_chat_quota(user_id: int, admin_user: str = Depends(get_current_admin)):
    """Đặt lại hạn mức chat trong 1 giờ gần nhất cho người dùng để tiếp tục test."""
    conn = get_admin_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM chatbot_history WHERE user_id = %s AND timestamp >= NOW() - INTERVAL 1 HOUR",
            (user_id,),
        )
        removed = cur.rowcount
        conn.commit()
        return {"status": "success", "removed_messages": removed, "message": f"Đã đặt lại hạn mức chat (xóa {removed} tin nhắn trong giờ qua)."}
    finally:
        cur.close()
        conn.close()


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin_user: str = Depends(get_current_admin)):
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, username FROM users WHERE id = %s LIMIT 1", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
        if row["username"] == DEFAULT_OWNER_USERNAME:
            raise HTTPException(status_code=400, detail="Không thể xóa tài khoản chủ dự án.")
    finally:
        cur.close()
        conn.close()

    execute_account_deletion(
        user_id=row["id"],
        username=row["username"],
        reason="Quản trị viên xóa trực tiếp từ bảng Users",
        deleted_by=admin_user,
    )
    return {"status": "deleted", "username": row["username"]}


# ── 4. Unified JSON Log Explorer ─────────────────────────────────────────────
@app.get("/api/admin/logs")
def explore_logs(
    category: str = Query("guardrail", pattern="^(guardrail|login|deletion|prediction|users)$"),
    q: str = Query("", max_length=100),
    limit: int = Query(100, ge=10, le=500),
    admin_user: str = Depends(get_current_admin),
):
    entries: List[Dict[str, Any]] = []

    if category == "guardrail" and GUARDRAIL_LOG_DIR.exists():
        for f in sorted(GUARDRAIL_LOG_DIR.glob("guardrail_*.json"), reverse=True):
            for item in reversed(_read_json_list(f)):
                entries.append({"_file": f.name, **item})
    elif category == "login" and LOGIN_LOG_DIR.exists():
        for f in sorted(LOGIN_LOG_DIR.glob("login_*.json"), reverse=True):
            for item in reversed(_read_json_list(f)):
                entries.append({"_file": f.name, **item})
    elif category == "deletion":
        for item in reversed(_read_json_list(DELETION_REQUEST_LOG_DIR / "deletion_requests.json")):
            entries.append({"_file": "deletion_requests.json", **item})
    elif category == "prediction" and PREDICTION_USER_LOG_DIR.exists():
        for f in sorted(PREDICTION_USER_LOG_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            for item in reversed(_read_json_list(f)):
                entries.append({"_file": f.name, **item})
    elif category == "users" and USER_LOG_DIR.exists():
        for f in sorted(USER_LOG_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            for item in reversed(_read_json_list(f)):
                entries.append({"_file": f.name, **item})

    if q.strip():
        needle = q.strip().lower()
        entries = [e for e in entries if needle in json.dumps(e, ensure_ascii=False).lower()]

    entries.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
    return {"category": category, "total": len(entries), "entries": entries[:limit]}


# ── 5. Runtime Kill Switch & Anonymized Research Export ──────────────────────
@app.get("/api/admin/control")
def read_control(admin_user: str = Depends(get_current_admin)):
    return get_runtime_control()


@app.put("/api/admin/control")
def write_control(patch: RuntimeControlPatch, admin_user: str = Depends(get_current_admin)):
    clean_patch = {k: v for k, v in patch.model_dump().items() if v is not None}
    updated = update_runtime_control(clean_patch, updated_by=admin_user)
    return {"status": "success", "control": updated}


@app.get("/api/admin/export/anonymized")
def export_anonymized_dataset(
    fmt: str = Query("csv", pattern="^(csv|json)$"),
    admin_user: str = Depends(get_current_admin),
):
    """Xuất bộ dữ liệu nghiên cứu đã ẩn danh hoàn toàn (loại bỏ username, email, phone)."""
    conn = get_admin_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """
            SELECT p.id, p.user_id, p.prediction_result, p.clinical_score,
                   p.probability, p.risk_level, p.inputs_json, p.timestamp,
                   u.terms_version, u.research_consent
            FROM prediction_history p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.id ASC
            """
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    salt = JWT_SECRET[:16]
    records = []
    for r in rows:
        anon_uid = "P_" + hashlib.sha256(f"{salt}:{r['user_id']}".encode("utf-8")).hexdigest()[:10].upper()
        inp = {}
        if r["inputs_json"]:
            try:
                inp = json.loads(r["inputs_json"]) if isinstance(r["inputs_json"], str) else r["inputs_json"]
            except Exception:
                inp = {}
        records.append(
            {
                "record_id": r["id"],
                "participant_anon_id": anon_uid,
                "terms_version": r["terms_version"] or "legacy",
                "research_consent": bool(r["research_consent"]),
                "age": inp.get("age"),
                "sex": inp.get("sex"),
                "height": inp.get("height"),
                "weight": inp.get("weight"),
                "bmi": inp.get("bmi"),
                "trestbps": inp.get("trestbps"),
                "chol": inp.get("chol"),
                "thalch": inp.get("thalch"),
                "oldpeak": inp.get("oldpeak"),
                "cp": inp.get("cp"),
                "restecg": inp.get("restecg"),
                "slope": inp.get("slope"),
                "fbs": inp.get("fbs"),
                "exang": inp.get("exang"),
                "ai_probability": round(float(r["probability"] or 0.0), 4),
                "ai_prediction": r["prediction_result"],
                "clinical_score": round(float(r["clinical_score"] or 0.0), 4),
                "risk_level": r["risk_level"],
                "timestamp": r["timestamp"].isoformat() if r["timestamp"] else None,
            }
        )

    if fmt == "json":
        return JSONResponse(content={"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(records), "records": records})

    buf = io.StringIO()
    fieldnames = list(records[0].keys()) if records else [
        "record_id", "participant_anon_id", "terms_version", "research_consent",
        "age", "sex", "bmi", "trestbps", "chol", "thalch", "oldpeak",
        "ai_probability", "ai_prediction", "clinical_score", "risk_level", "timestamp",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(records)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=heartguard_pilot_anonymized.csv"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=ADMIN_PORT, log_level="info")
