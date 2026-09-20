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
from app.auth import get_current_user
from app.config import GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_COMPLETION_TOKENS, GROQ_REQUEST_TIMEOUT_SECONDS
from app.database import get_conn, get_user_id
from app.schemas import ChatInput
from app.state import state

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chatbot"])

HOURLY_LIMIT = 20
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
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT COUNT(*) as count FROM chatbot_history WHERE user_id = %s "
            "AND role = 'user' AND timestamp >= NOW() - INTERVAL 1 HOUR", (user_id,),
        )
        if cursor.fetchone()["count"] >= HOURLY_LIMIT:
            raise HTTPException(status_code=429, detail="Bạn đã dùng hết 20 lượt tư vấn/giờ.")
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
    """Gửi tin nhắn tới model được cấu hình trên Groq."""
    if not state.groq_ready:
        raise HTTPException(status_code=503, detail="Dịch vụ AI Chatbot hiện đang bảo trì")

    user_id, history_rows = await run_in_threadpool(_load_chat_context, current_user)
    messages = [{
        "role": "system",
        "content": "Bạn là một trợ lý AI chuyên về tư vấn phòng ngừa bệnh tim mạch. Hãy trả lời ngắn gọn, thân thiện, mang tính khoa học và luôn khuyên người dùng đi khám bác sĩ khi có dấu hiệu nặng."
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
    await run_in_threadpool(_save_chat_exchange, user_id, body.message, ai_response)
    return {"response": ai_response}

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
        return {
            "username":   current_user,
            "used":       used_this_hour,
            "limit":      HOURLY_LIMIT,
            "remaining":  max(0, HOURLY_LIMIT - used_this_hour),
        }
    finally:
        cursor.close()
        conn.close()
