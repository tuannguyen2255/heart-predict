# 🛡️ HeartGuard Admin Control Center (`admin_system/`)

Hệ thống quản trị nội bộ dành riêng cho chủ dự án (**Nguyễn Minh Tuấn**), chạy độc lập tại **`http://127.0.0.1:8090`** và **khóa cứng chỉ cho phép truy cập từ `localhost` (`127.0.0.1`)** — người ngoài đi qua Vercel hoặc Cloudflare Tunnel không bao giờ truy cập được cổng này.

---

## 🚀 Cách khởi chạy (1 cú nhấp chuột)

- **Cách 1:** Nhấp đúp vào file [`start_admin.bat`](./start_admin.bat) (tự động mở trình duyệt tại `http://127.0.0.1:8090`).
- **Cách 2 (Terminal):**
  ```powershell
  .\.venv\Scripts\python.exe admin_system\admin_server.py
  ```

---

## ✨ 5 Phân hệ Chức năng Đồng bộ Thời gian thực

1. **📊 Tổng quan & Phễu Chuyển đổi Pilot (Overview & Funnel):**
   - Theo dõi tiến độ `X / 100` người dùng Pilot, tỷ lệ đồng ý Điều khoản `beta-v1.0`, phễu chuyển đổi 6 bước (Đăng ký → Consent → Hồ sơ → Đánh giá → Hỏi AI → Quay lại lần 2+), và phân bố 4 mức nguy cơ (`THẤP`, `TRUNG BÌNH`, `CAO`, `RẤT CAO`).
2. **⏳ Hàng đợi Yêu cầu Xóa Tài khoản (Cam kết 24 giờ):**
   - Đồng bộ trực tiếp với bảng `account_deletion_requests` khi người dùng bấm yêu cầu xóa kèm lý do trên trang Hồ sơ.
   - Hiển thị **đồng hồ đếm ngược 24h**, nút **Duyệt & Xóa ngay** (xóa sạch MySQL + xóa file log JSON cá nhân + ghi biên bản), nút **Tạm giữ/Từ chối**, và tiến trình nền **Tự động xóa các yêu cầu đã qua 24h** mỗi 5 phút.
3. **👥 Quản lý Người dùng & Kiểm toán Pháp lý (360° User Inspector):**
   - Xem bằng chứng đồng ý điều khoản (`terms_version`, `accepted_terms_at`, `>= 18 tuổi`).
   - Bấm **Chi tiết 360°** để xem toàn bộ Hồ sơ sức khỏe, Lịch sử đánh giá (`inputs_json`), Lịch sử chat và cả nội dung file JSON trong `logs/logs_prediction_users/` trên cùng 1 màn hình.
   - Hỗ trợ **Reset lượt Chat trong giờ** để tester tiếp tục thử nghiệm.
4. **🛡️ Trung tâm Nhật ký JSON & Guardrail (`logs/`):**
   - Đọc trực tiếp cả 5 luồng log JSON (`guardrail`, `logs_login`, `prediction_with_users`, `users`, `deletion_requests`) kèm bộ lọc từ khóa tức thì — không cần mở từng file thủ công.
5. **⚡ Công tắc Khẩn cấp (Live Kill Switch) & Xuất CSV Ẩn danh:**
   - Bật/tắt **Chatbot AI**, **Đăng ký mới**, **API Ước lượng**, hoặc đổi **giới hạn 100 người / giới hạn lượt chat** có hiệu lực ngay lập tức trên cổng `:8000` qua `logs/runtime_control.json` mà **không cần khởi động lại `uvicorn`**.
   - Xuất **1-Click CSV nghiên cứu ẩn danh** (băm mã `P_xxxx`, bỏ hoàn toàn `username/email/phone`) để phân tích hoặc đưa vào Portfolio.
