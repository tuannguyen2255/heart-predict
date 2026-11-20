"""
runtime_control.py — Đồng bộ trạng thái điều khiển thời gian thực (Kill Switch, giới hạn Pilot)
giữa Backend chính (:8000) và Hệ thống Quản trị Admin (admin_system :8090) qua file JSON dùng chung.
"""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import threading
from typing import Any, Dict

from app.config import CHATBOT_DISABLED, FREE_CHAT_LIMIT

_LOCK = threading.Lock()
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_LOG_ROOT = Path(os.getenv("LOG_DIR", str(_PROJECT_ROOT / "logs")))
CONTROL_FILE = _LOG_ROOT / "runtime_control.json"

_CACHE: Dict[str, Any] = {}
_CACHE_MTIME: float = -1.0


def _default_control() -> Dict[str, Any]:
    return {
        "chatbot_disabled": bool(CHATBOT_DISABLED),
        "registration_disabled": False,
        "prediction_disabled": False,
        "hourly_chat_limit": int(FREE_CHAT_LIMIT),
        "max_pilot_users": 100,
        "auto_purge_24h_deletions": True,
        "pilot_notice": "Phiên bản thử nghiệm nghiên cứu giới hạn 100 người dùng.",
        "updated_at": None,
        "updated_by": "system",
    }


def get_runtime_control() -> Dict[str, Any]:
    """Đọc cấu hình điều khiển thời gian thực (có cache theo mtime để không tốn I/O)."""
    global _CACHE, _CACHE_MTIME
    base = _default_control()
    try:
        if not CONTROL_FILE.exists():
            return base
        mtime = CONTROL_FILE.stat().st_mtime
        if mtime == _CACHE_MTIME and _CACHE:
            merged = dict(base)
            merged.update(_CACHE)
            return merged
        with _LOCK:
            data = json.loads(CONTROL_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                _CACHE = data
                _CACHE_MTIME = mtime
                merged = dict(base)
                merged.update(data)
                return merged
    except Exception:
        pass
    return base


def update_runtime_control(patch: Dict[str, Any], updated_by: str = "admin") -> Dict[str, Any]:
    """Cập nhật cấu hình điều khiển thời gian thực từ trang Admin."""
    global _CACHE, _CACHE_MTIME
    current = get_runtime_control()
    allowed_keys = {
        "chatbot_disabled",
        "registration_disabled",
        "prediction_disabled",
        "hourly_chat_limit",
        "max_pilot_users",
        "auto_purge_24h_deletions",
        "pilot_notice",
    }
    for k, v in patch.items():
        if k in allowed_keys:
            current[k] = v

    current["hourly_chat_limit"] = max(1, min(200, int(current.get("hourly_chat_limit", FREE_CHAT_LIMIT))))
    current["max_pilot_users"] = max(0, min(10000, int(current.get("max_pilot_users", 100))))
    current["updated_at"] = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    current["updated_by"] = updated_by

    with _LOCK:
        CONTROL_FILE.parent.mkdir(parents=True, exist_ok=True)
        CONTROL_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
        _CACHE = dict(current)
        _CACHE_MTIME = CONTROL_FILE.stat().st_mtime
    return current
