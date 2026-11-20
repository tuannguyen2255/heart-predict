# Bản Mô tả Phạm vi Thử nghiệm (Pilot Overview)

- **Tên hệ thống:** HeartGuard — Nguyên mẫu nghiên cứu ước lượng nguy cơ tim mạch & Trợ lý giải đáp thông tin AI
- **Người thực hiện:** Nguyễn Minh Tuấn (Sinh viên, UTH – University of Transport)
- **Mục đích:** Dự án kỹ thuật & nghiên cứu cá nhân phục vụ hoàn thiện sản phẩm và hồ sơ ứng tuyển (Portfolio), **100% phi thương mại**.
- **Liên hệ:** `tuannguyen2205@gmail.com`

---

## 1. Mục tiêu đợt thử nghiệm nhỏ (Pilot)
- Quy mô dự kiến: **khoảng 100 người dùng đầu tiên** (mời chọn lọc, không phát tán quảng bá như dịch vụ y tế).
- Thời gian mở hệ thống: **3–4 ngày** theo khung giờ thông báo trước.
- Trọng tâm đánh giá:
  1. **Tính dễ dùng (Usability):** Giao diện nhập liệu, tốc độ phản hồi, trải nghiệm trên máy tính và điện thoại.
  2. **Độ dễ hiểu (Clarity):** Cách trình bày kết quả ước lượng, phiếu PDF và phản hồi của Trợ lý AI có dễ hiểu và không gây hiểu nhầm y khoa hay không.
  3. **Độ ổn định kỹ thuật:** Kiểm chứng tải thực tế của kiến trúc Next.js (Vercel) + FastAPI/MySQL + Groq API.

## 2. Cơ chế bảo vệ người tham gia
1. **Phi thương mại tuyệt đối:** Ẩn toàn bộ tính năng nâng cấp Premium / mã QR thanh toán.
2. **Đồng ý chủ động (Clickwrap Consent):** Người dùng phải xác nhận đủ 18 tuổi và tick đồng ý điều khoản trước khi tạo tài khoản; hệ thống lưu phiên bản điều khoản và thời điểm xác nhận.
3. **Ngôn ngữ trung tính kiểu cổng thông tin y tế:** Không dùng từ khẳng định chẩn đoán/an toàn; banner miễn trừ trách nhiệm luôn hiển thị tại trang kết quả, bản in PDF và khung Chatbot.
4. **Guardrail Chatbot nhiều lớp:** Chặn cứng các câu hỏi về thuốc, liều lượng, tự điều trị và tình huống cấp cứu ngay tại Backend trước khi gọi LLM, trả về thông điệp an toàn cố định hướng dẫn liên hệ bác sĩ / gọi 115.
5. **Khuyến khích ca giả lập & Xóa dữ liệu sau pilot:** Khuyến khích người tham gia trải nghiệm bằng hồ sơ mẫu; xóa toàn bộ dữ liệu cá nhân định danh trong vòng 14 ngày sau khi kết thúc đợt thử nghiệm (hoặc trong vòng 72 giờ theo yêu cầu qua email).

## 3. Quyền tạm dừng khẩn cấp (Kill Switch)
Trong suốt 3–4 ngày thử nghiệm, người thực hiện duy trì 3 mức dừng ngay lập tức:
- **Mức 1:** Tắt tính năng Chatbot AI (`CHATBOT_DISABLED`) trong khi giữ nguyên các trang khác.
- **Mức 2:** Bật thông báo tạm dừng / kết thúc thử nghiệm trên giao diện Frontend.
- **Mức 3:** Ngắt kết nối đường hầm API (Cloudflare Tunnel) để đóng toàn bộ truy cập Backend ngay lập tức.
