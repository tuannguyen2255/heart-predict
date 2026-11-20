"""
audit_logger.py — Ghi log JSON có cấu trúc phục vụ kiểm tra lỗi và đối chiếu an toàn.
Tuyệt đối KHÔNG ghi mật khẩu, password hash hay JWT token.
"""
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import threading
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)
_LOCK = threading.Lock()

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_LOG_ROOT = Path(os.getenv("LOG_DIR", str(_PROJECT_ROOT / "logs")))

PREDICTION_USER_LOG_DIR = _LOG_ROOT / "logs_prediction_users" / "prediction_with_users"
USER_LOG_DIR = _LOG_ROOT / "logs_prediction_users" / "users"
LOGIN_LOG_DIR = _LOG_ROOT / "logs_login"
GUARDRAIL_LOG_DIR = _LOG_ROOT / "logs_chatbot_guardrail"
DELETION_REQUEST_LOG_DIR = _LOG_ROOT / "logs_deletion_requests"


def _safe_filename(username: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", (username or "unknown").strip())
    return cleaned[:64] or "unknown"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _append_json_array(file_path: Path, entry: Dict[str, Any]) -> None:
    try:
        with _LOCK:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            records = []
            if file_path.exists():
                try:
                    loaded = json.loads(file_path.read_text(encoding="utf-8"))
                    if isinstance(loaded, list):
                        records = loaded
                except Exception:
                    records = []
            records.append(entry)
            file_path.write_text(
                json.dumps(records, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
    except Exception as exc:
        logger.warning("Không thể ghi audit log %s: %s", file_path.name, exc)


def log_prediction_event(
    username: str,
    event: str,
    payload: Dict[str, Any],
) -> None:
    """Lưu JSON kết quả đánh giá theo tên đăng nhập user."""
    entry = {
        "timestamp": _utc_now_iso(),
        "username": username,
        "event": event,
        **payload,
    }
    target = PREDICTION_USER_LOG_DIR / f"{_safe_filename(username)}.json"
    _append_json_array(target, entry)


def log_user_event(
    username: str,
    event: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Lưu JSON sự kiện vòng đời tài khoản/hồ sơ của user (không chứa mật khẩu/token)."""
    entry = {
        "timestamp": _utc_now_iso(),
        "username": username,
        "event": event,
        **(details or {}),
    }
    target = USER_LOG_DIR / f"{_safe_filename(username)}.json"
    _append_json_array(target, entry)


def log_login_event(
    username: str,
    status: str,
    client_ip: Optional[str] = None,
    terms_version: Optional[str] = None,
    needs_terms_reaccept: Optional[bool] = None,
    reason: Optional[str] = None,
) -> None:
    """Lưu JSON sự kiện đăng nhập theo ngày (không chứa mật khẩu/token)."""
    today = datetime.now().strftime("%Y-%m-%d")
    entry: Dict[str, Any] = {
        "timestamp": _utc_now_iso(),
        "username": username,
        "status": status,
        "client_ip": client_ip,
    }
    if terms_version is not None:
        entry["terms_version"] = terms_version
    if needs_terms_reaccept is not None:
        entry["needs_terms_reaccept"] = needs_terms_reaccept
    if reason:
        entry["reason"] = reason

    target = LOGIN_LOG_DIR / f"login_{today}.json"
    _append_json_array(target, entry)


def log_guardrail_event(
    username: str,
    stage: str,
    reason: str,
    prompt_version: str,
) -> None:
    """Ghi nhận lượt chặn an toàn Chatbot (không lưu nội dung nhạy cảm định danh)."""
    today = datetime.now().strftime("%Y-%m-%d")
    entry = {
        "timestamp": _utc_now_iso(),
        "username": username,
        "stage": stage,
        "reason": reason,
        "prompt_version": prompt_version,
    }
    target = GUARDRAIL_LOG_DIR / f"guardrail_{today}.json"
    _append_json_array(target, entry)


def log_deletion_request_event(
    username: str,
    action: str,
    reason: Optional[str] = None,
    scheduled_delete_at: Optional[str] = None,
) -> None:
    """Ghi nhận yêu cầu xóa tài khoản (chờ duyệt trong 24 giờ) vào JSON để quản trị viên theo dõi."""
    entry: Dict[str, Any] = {
        "timestamp": _utc_now_iso(),
        "username": username,
        "action": action,
    }
    if reason:
        entry["reason"] = reason
    if scheduled_delete_at:
        entry["scheduled_delete_at"] = scheduled_delete_at
    target = DELETION_REQUEST_LOG_DIR / "deletion_requests.json"
    _append_json_array(target, entry)


def delete_user_logs(username: str) -> None:
    """Xóa file log cá nhân khi người dùng yêu cầu xóa toàn bộ tài khoản & dữ liệu."""
    safe = _safe_filename(username)
    for folder in (PREDICTION_USER_LOG_DIR, USER_LOG_DIR):
        path = folder / f"{safe}.json"
        try:
            with _LOCK:
                if path.exists():
                    path.unlink()
        except Exception as exc:
            logger.warning("Không thể xóa file log %s: %s", path.name, exc)
