"""
routers/users.py
"""
import logging
import bcrypt
import mysql.connector
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm

from app.audit_logger import delete_user_logs, log_deletion_request_event, log_login_event, log_user_event
from app.auth import create_token, get_current_user
from app.config import CURRENT_TERMS_VERSION, EMAIL_RE
from app.database import get_conn, validate_password, get_user_id
from app.runtime_control import get_runtime_control
from app.schemas import AcceptTermsRequest, DeleteAccountRequest, PasswordChange, RegisterRequest, ProfileUpdateInput

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Users"])


@router.post("/register", status_code=201)
def register_user(body: RegisterRequest):
    """Đăng ký tài khoản mới (bắt buộc xác nhận đủ 18 tuổi và đồng ý điều khoản)."""
    ctrl = get_runtime_control()
    if ctrl.get("registration_disabled"):
        raise HTTPException(
            status_code=503,
            detail="Đợt đăng ký thử nghiệm hiện đang tạm đóng bởi quản trị viên. Cảm ơn bạn đã quan tâm!",
        )
    if not body.accepted_terms or not body.age_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Bạn cần xác nhận từ đủ 18 tuổi và đồng ý Điều khoản sử dụng & Chính sách bảo vệ dữ liệu trước khi đăng ký.",
        )
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Mật khẩu xác nhận không khớp")
    if body.phone and len(body.phone) > 12:
        raise HTTPException(status_code=400, detail="Số điện thoại không hợp lệ (tối đa 12 ký tự)")
    if body.email and len(body.email) > 255:
        raise HTTPException(status_code=400, detail="Email quá dài")

    conn = get_conn()
    cursor = conn.cursor()
    try:
        max_pilot = int(ctrl.get("max_pilot_users") or 0)
        if max_pilot > 0:
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]
            if total_users >= max_pilot:
                raise HTTPException(
                    status_code=503,
                    detail=f"Đợt thử nghiệm đã đạt giới hạn tối đa {max_pilot} người tham gia.",
                )
        # Kiểm tra trùng lặp tập trung bằng 1 câu truy vấn tối ưu
        cursor.execute(
            "SELECT username, email, phone FROM users WHERE username = %s OR email = %s OR (phone IS NOT NULL AND phone = %s) LIMIT 1",
            (body.username, body.email, body.phone)
        )
        existing = cursor.fetchone()
        if existing:
            if existing[0] == body.username:
                raise HTTPException(status_code=400, detail="Username đã tồn tại")
            if existing[1] == body.email:
                raise HTTPException(status_code=400, detail="Email đã tồn tại")
            raise HTTPException(status_code=400, detail="Số điện thoại đã tồn tại")

        validate_password(body.password)
        hashed = bcrypt.hashpw(body.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        terms_version = (body.terms_version or CURRENT_TERMS_VERSION).strip()[:32]

        # Insert user mới kèm bằng chứng đồng ý điều khoản
        cursor.execute(
            "INSERT INTO users (username, password, email, phone, terms_version, accepted_terms_at, age_confirmed, research_consent) "
            "VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s)",
            (
                body.username,
                hashed,
                body.email,
                body.phone,
                terms_version,
                1 if body.age_confirmed else 0,
                1 if body.research_consent else 0,
            ),
        )
        user_id = cursor.lastrowid

        # Khởi tạo bản ghi rỗng bên hồ sơ sức khỏe user_information
        cursor.execute("INSERT INTO user_information (user_id) VALUES (%s)", (user_id,))
        
        conn.commit()
        log_user_event(
            body.username,
            "register",
            {
                "has_email": bool(body.email),
                "has_phone": bool(body.phone),
                "terms_version": terms_version,
                "age_confirmed": bool(body.age_confirmed),
                "research_consent": bool(body.research_consent),
            },
        )
        return {"status": "success", "message": "Đăng ký thành công", "terms_version": terms_version}
    finally:
        cursor.close()
        conn.close()


@router.post("/login")
def login_user(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Đăng nhập bằng OAuth2 chuẩn hóa."""
    client_ip = request.client.host if request.client else None
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, password, terms_version FROM users WHERE username = %s LIMIT 1",
            (form_data.username,),
        )
        user = cursor.fetchone()

        if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user['password'].encode('utf-8')):
            log_login_event(
                form_data.username,
                status="failed",
                client_ip=client_ip,
                reason="invalid_credentials",
            )
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")

        access_token = create_token(form_data.username, role="user")
        accepted_version = user.get("terms_version")
        needs_reaccept = accepted_version != CURRENT_TERMS_VERSION
        log_login_event(
            form_data.username,
            status="success",
            client_ip=client_ip,
            terms_version=accepted_version,
            needs_terms_reaccept=needs_reaccept,
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "terms_version": accepted_version,
            "current_terms_version": CURRENT_TERMS_VERSION,
            "needs_terms_reaccept": needs_reaccept,
        }
    finally:
        cursor.close()
        conn.close()


@router.get("/information/me", tags=["User Profile"])
def get_user_profile(current_user: str = Depends(get_current_user)):
    """Lấy thông tin hồ sơ sức khỏe cá nhân."""
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        user_id = get_user_id(cursor, current_user)
        # Chỉ định danh cụ thể các trường sinh học để tăng hiệu năng tối đa
        cursor.execute(
            "SELECT age, sex, height, weight, blood_pressure, cholesterol FROM user_information WHERE user_id = %s LIMIT 1",
            (user_id,)
        )
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ người dùng.")
        return profile
    finally:
        cursor.close()
        conn.close()


@router.put("/user/profile", tags=["User Profile"])
def update_user_profile(profile_data: ProfileUpdateInput, current_user: str = Depends(get_current_user)):
    """Cập nhật thông tin sinh học động bằng Prepared Statement."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        update_dict = profile_data.model_dump(exclude_unset=True)
        
        if not update_dict:
            return {"message": "Không có thông tin nào thay đổi."}
            
        fields = [f"{key} = %s" for key in update_dict.keys()]
        query = f"UPDATE user_information SET {', '.join(fields)} WHERE user_id = %s"
        values = list(update_dict.values()) + [user_id]
        
        cursor.execute(query, tuple(values))
        conn.commit()
        log_user_event(current_user, "profile_update", {"fields": update_dict})
        return {"message": "Cập nhật hồ sơ sức khỏe thành công"}
    finally:
        cursor.close()
        conn.close()


@router.post("/user/accept-terms", tags=["User Profile"])
def accept_terms(body: AcceptTermsRequest, current_user: str = Depends(get_current_user)):
    """Ghi nhận người dùng xác nhận lại phiên bản điều khoản mới."""
    if not body.age_confirmed:
        raise HTTPException(status_code=400, detail="Cần xác nhận từ đủ 18 tuổi để tiếp tục sử dụng.")
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        version = body.terms_version.strip()[:32] or CURRENT_TERMS_VERSION
        cursor.execute(
            "UPDATE users SET terms_version = %s, accepted_terms_at = NOW(), age_confirmed = %s, research_consent = %s WHERE id = %s",
            (version, 1 if body.age_confirmed else 0, 1 if body.research_consent else 0, user_id),
        )
        conn.commit()
        log_user_event(
            current_user,
            "accept_terms",
            {
                "terms_version": version,
                "age_confirmed": bool(body.age_confirmed),
                "research_consent": bool(body.research_consent),
            },
        )
        return {"status": "success", "terms_version": version}
    finally:
        cursor.close()
        conn.close()


@router.get("/user/deletion-request", tags=["User Profile"])
def get_deletion_request(current_user: str = Depends(get_current_user)):
    """Kiểm tra xem tài khoản hiện tại có yêu cầu xóa đang chờ duyệt trong 24 giờ không."""
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT id, reason, status, requested_at, scheduled_delete_at "
            "FROM account_deletion_requests WHERE user_id = %s AND status = 'pending' "
            "ORDER BY id DESC LIMIT 1",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            return {"pending": False}
        return {
            "pending": True,
            "id": row["id"],
            "reason": row["reason"],
            "status": row["status"],
            "requested_at": row["requested_at"].isoformat() if row["requested_at"] else None,
            "scheduled_delete_at": row["scheduled_delete_at"].isoformat() if row["scheduled_delete_at"] else None,
        }
    finally:
        cursor.close()
        conn.close()


@router.post("/user/deletion-request", status_code=201, tags=["User Profile"])
def create_deletion_request(body: DeleteAccountRequest, current_user: str = Depends(get_current_user)):
    """Gửi yêu cầu xóa tài khoản kèm lý do — quản trị viên duyệt & cam kết xóa trong vòng 24 giờ."""
    reason = body.reason.strip()
    if len(reason) < 5:
        raise HTTPException(status_code=400, detail="Vui lòng nhập lý do muốn xóa (tối thiểu 5 ký tự).")
    conn = get_conn()
    cursor = conn.cursor(dictionary=True)
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "SELECT id, scheduled_delete_at FROM account_deletion_requests "
            "WHERE user_id = %s AND status = 'pending' LIMIT 1",
            (user_id,),
        )
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Bạn đã có một yêu cầu xóa tài khoản đang chờ xử lý trong vòng 24 giờ.",
            )

        cursor.execute(
            "INSERT INTO account_deletion_requests (user_id, username, reason, status, scheduled_delete_at) "
            "VALUES (%s, %s, %s, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR))",
            (user_id, current_user, reason),
        )
        req_id = cursor.lastrowid
        cursor.execute(
            "SELECT requested_at, scheduled_delete_at FROM account_deletion_requests WHERE id = %s",
            (req_id,),
        )
        times = cursor.fetchone()
        conn.commit()

        scheduled_iso = times["scheduled_delete_at"].isoformat() if times and times["scheduled_delete_at"] else None
        log_deletion_request_event(current_user, "requested", reason=reason, scheduled_delete_at=scheduled_iso)
        log_user_event(current_user, "deletion_requested", {"reason": reason, "scheduled_delete_at": scheduled_iso})

        return {
            "status": "pending",
            "id": req_id,
            "reason": reason,
            "requested_at": times["requested_at"].isoformat() if times and times["requested_at"] else None,
            "scheduled_delete_at": scheduled_iso,
            "message": "Đã tiếp nhận yêu cầu xóa tài khoản. Quản trị viên sẽ xem xét và cam kết xóa toàn bộ dữ liệu trong vòng 24 giờ nếu không có vấn đề phát sinh.",
        }
    finally:
        cursor.close()
        conn.close()


@router.delete("/user/deletion-request", tags=["User Profile"])
def cancel_deletion_request(current_user: str = Depends(get_current_user)):
    """Hủy yêu cầu xóa tài khoản đang ở trạng thái chờ duyệt."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute(
            "UPDATE account_deletion_requests SET status = 'cancelled' WHERE user_id = %s AND status = 'pending'",
            (user_id,),
        )
        conn.commit()
        log_deletion_request_event(current_user, "cancelled")
        log_user_event(current_user, "deletion_cancelled")
        return {"status": "cancelled", "message": "Đã hủy yêu cầu xóa tài khoản."}
    finally:
        cursor.close()
        conn.close()


@router.delete("/user/me", tags=["User Profile"])
def delete_my_account(current_user: str = Depends(get_current_user)):
    """Xóa hoàn toàn tài khoản và toàn bộ dữ liệu liên quan (ON DELETE CASCADE)."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        user_id = get_user_id(cursor, current_user)
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        delete_user_logs(current_user)
        return {"status": "success", "message": "Đã xóa tài khoản và toàn bộ dữ liệu liên quan."}
    finally:
        cursor.close()
        conn.close()