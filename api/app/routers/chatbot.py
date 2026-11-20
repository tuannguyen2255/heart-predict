"""
routers/chatbot.py
"""
import logging
import time
from uuid import uuid4
import anyio
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from starlette.concurrency import run_in_threadpool
from app.audit_logger import log_guardrail_event
from app.auth import get_current_user
from app.chat_guardrails import (
    PROMPT_VERSION,
    SYSTEM_PROMPT,
    append_disclaimer_footer,
    check_input_guardrail,
    sanitize_output,
)
from app.config import (
    CHATBOT_DISABLED,
    FREE_CHAT_LIMIT,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_MAX_COMPLETION_TOKENS,
    GROQ_REQUEST_TIMEOUT_SECONDS,
)
from app.database import get_conn, get_user_id
from app.runtime_control import get_runtime_control
from app.schemas import ChatInput
from app.state import state

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chatbot"])

HOURLY_LIMIT = FREE_CHAT_LIMIT
_GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json",
}

async def _call_groq(messages: list) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API Key chưa được cấu hình.")
    
    payload = {"model": GROQ_MODEL, "messages": messages, "temperature": 0.3,
               "max_completion_tokens": GROQ_MAX_COMPLETION_TOKENS}
    if GROQ_MODEL in {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}:
        payload["reasoning_effort"] = "low"
    if state.http_client is None:
        raise HTTPException(status_code=503, detail="AI client unavailable")
    request_id = uuid4().hex[:12]
    started = time.perf_counter()
    try:
        # HTTPX read timeout is an inactivity timeout; also bound the whole call.
        with anyio.fail_after(GROQ_REQUEST_TIMEOUT_SECONDS):
            response = await state.http_client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=_GROQ_HEADERS, json=payload,
            )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Empty AI response")
        logger.info("Groq completed request_id=%s model=%s elapsed_ms=%.0f", request_id, GROQ_MODEL,
                    (time.perf_counter() - started) * 1000)
        return content
    except (httpx.HTTPError, TimeoutError, KeyError, IndexError, ValueError, TypeError) as exc:
        upstream_status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        # Do not log API keys, prompts, conversation content, or response bodies.
        logger.warning("Groq failed request_id=%s model=%s kind=%s upstream_status=%s elapsed_ms=%.0f",
                       request_id, GROQ_MODEL, type(exc).__name__, upstream_status,
                       (time.perf_counter() - started) * 1000)
        if isinstance(exc, httpx.PoolTimeout) or upstream_status == 429:
            status_code, detail = 503, "Dịch vụ AI đang bận. Vui lòng thử lại sau ít phút."
        elif isinstance(exc, (httpx.TimeoutException, TimeoutError)) or upstream_status == 504:
            status_code, detail = 504, "AI phản hồi quá lâu. Nội dung chưa được lưu; bạn có thể gửi lại."
        else:
            status_code, detail = 502, "Không thể kết nối dịch vụ AI. Vui lòng thử lại sau."
        # An upstream 401 is an API-key error, not an expired browser session.
        raise HTTPException(status_code=status_code, detail=detail, headers={"X-Request-ID": request_id}) from exc


def _load_chat_context(current_user: str):
    """Read context in a worker and release the connection before awaiting Groq."""
    hourly_limit = int(get_runtime_control().get("hourly_chat_limit") or HOURLY_LIMIT)
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT COUNT(*) as count FROM chatbot_history WHERE user_id = %s "
            "AND role = 'user' AND timestamp >= NOW() - INTERVAL 1 HOUR", (user_id,),
        )
        if cursor.fetchone()["count"] >= hourly_limit:
            raise HTTPException(status_code=429, detail=f"Bạn đã dùng hết {hourly_limit} lượt giải đáp/giờ.")
        cursor.execute(
            "SELECT role, content FROM chatbot_history WHERE user_id = %s "
            "ORDER BY timestamp DESC, id DESC LIMIT 15", (user_id,),
        )
        return user_id, list(reversed(cursor.fetchall()))
    finally:
        cursor.close()
        conn.close()


def _save_chat_exchange(user_id: int, message: str, answer: str):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.executemany(
            "INSERT INTO chatbot_history (user_id, role, content) VALUES (%s, %s, %s)",
            [(user_id, "user", message), (user_id, "assistant", answer)],
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

@router.post("/chatbot")
async def chat_with_bot(body: ChatInput, current_user: str = Depends(get_current_user)):
    """Gửi tin nhắn tới Trợ lý giải đáp thông tin AI kèm lớp bảo vệ nhiều tầng."""
    if CHATBOT_DISABLED or get_runtime_control().get("chatbot_disabled"):
        raise HTTPException(
            status_code=503,
            detail="Trợ lý giải đáp thông tin AI hiện đang tạm nghỉ. Các tính năng khác vẫn hoạt động bình thường.",
        )

    user_id, history_rows = await run_in_threadpool(_load_chat_context, current_user)

    # Tầng 1: Lọc cứng đầu vào (thuốc/liều, cấp cứu, prompt injection) — KHÔNG gọi LLM
    block_reason, safe_response = check_input_guardrail(body.message)
    if block_reason and safe_response:
        final_reply = append_disclaimer_footer(safe_response)
        await run_in_threadpool(log_guardrail_event, current_user, "input_block", block_reason, PROMPT_VERSION)
        await run_in_threadpool(_save_chat_exchange, user_id, body.message, final_reply)
        return {"response": final_reply, "guardrail_triggered": block_reason}

    if not state.groq_ready:
        raise HTTPException(status_code=503, detail="Dịch vụ AI Chatbot hiện đang bảo trì")

    # Tầng 2: System prompt nghiêm ngặt, trung tính kiểu cổng thông tin y tế
    messages = [{
        "role": "system",
        "content": SYSTEM_PROMPT,
    }]
    # Keep complete recent messages within a character budget, without truncating
    # the current question or slicing a clinical detail in the middle.
    remaining_chars = 12000 - len(body.message) - len(messages[0]["content"])
    recent_history = []
    for row in reversed(history_rows):
        if len(row["content"]) > remaining_chars:
            break
        recent_history.append({"role": row["role"], "content": row["content"]})
        remaining_chars -= len(row["content"])
    messages.extend(reversed(recent_history))
    messages.append({"role": "user", "content": body.message})

    ai_response = await _call_groq(messages)

    # Tầng 3: Quét đầu ra LLM & Tầng 4: Gắn dòng miễn trừ ngắn cố định
    ai_response, output_flag = sanitize_output(ai_response)
    if output_flag:
        await run_in_threadpool(log_guardrail_event, current_user, "output_filter", output_flag, PROMPT_VERSION)
    final_reply = append_disclaimer_footer(ai_response)

    await run_in_threadpool(_save_chat_exchange, user_id, body.message, final_reply)
    return {"response": final_reply}

@router.get("/chatbot/history")
def get_chat_history(
    response: Response,
    current_user: str = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0, le=100000),
):
    """Lấy một trang tin nhắn gần nhất, hiển thị theo thứ tự thời gian."""
    response.headers["Cache-Control"] = "private, no-store"
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT role, content FROM chatbot_history WHERE user_id = %s ORDER BY timestamp DESC, id DESC LIMIT %s OFFSET %s",
            (user_id, limit, offset),
        )
        return [{"role": r[0], "content": r[1]} for r in reversed(cursor.fetchall())]
    finally:
        cursor.close()
        conn.close()

@router.get("/user/chat-status")
def get_chat_status(current_user: str = Depends(get_current_user)):
    """Kiểm tra số lượt chat còn lại trong giờ của user."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT COUNT(*) FROM chatbot_history WHERE user_id = %s AND role = 'user' AND timestamp >= NOW() - INTERVAL 1 HOUR",
            (user_id,),
        )
        used_this_hour = cursor.fetchone()[0]
        hourly_limit = int(get_runtime_control().get("hourly_chat_limit") or HOURLY_LIMIT)
        return {
            "username":   current_user,
            "used":       used_this_hour,
            "limit":      hourly_limit,
            "remaining":  max(0, hourly_limit - used_this_hour),
        }
    finally:
        cursor.close()
        conn.close()
