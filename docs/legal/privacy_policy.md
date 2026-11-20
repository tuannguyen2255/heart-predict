# Chính sách Bảo vệ Dữ liệu & Quyền Riêng tư — HeartGuard

- **Phiên bản:** `beta-v1.0`
- **Ngày hiệu lực:** 20/11/2026
- **Người chịu trách nhiệm quản lý dữ liệu:** Nguyễn Minh Tuấn (`tuannguyen2205@gmail.com`)

---

## 1. Nguyên tắc tối thiểu hóa dữ liệu
Dữ liệu sức khỏe là **dữ liệu cá nhân nhạy cảm**. Trong đợt thử nghiệm này, chúng tôi áp dụng nguyên tắc thu thập ở mức tối thiểu nhất:
- Khuyến khích người tham gia sử dụng **tên đăng nhập ẩn danh (nickname)** và **dữ liệu giả lập (ca mẫu)**.
- Không yêu cầu họ tên thật, số CCCD hay địa chỉ cư trú.
- Khuyến nghị **không nhập thông tin định danh thật hoặc ảnh/mã hồ sơ bệnh án** vào khung trò chuyện AI.

## 2. Dữ liệu hệ thống thu thập và lưu trữ
Khi bạn đăng ký và trải nghiệm HeartGuard, hệ thống lưu các thông tin sau trong cơ sở dữ liệu riêng của dự án:
1. **Thông tin tài khoản:** Tên đăng nhập, mật khẩu (đã băm bằng `bcrypt`, không lưu dạng chữ rõ), email/số điện thoại (nếu bạn tự nguyện cung cấp).
2. **Bằng chứng đồng ý điều khoản:** Phiên bản điều khoản đã đồng ý (`terms_version`), thời điểm xác nhận (`accepted_at`), xác nhận đủ 18 tuổi.
3. **Dữ liệu đánh giá tham khảo:** Các chỉ số bạn nhập vào biểu mẫu (tuổi, giới tính, chiều cao, cân nặng, huyết áp, cholesterol, nhịp tim, chỉ số điện tâm đồ giả lập/tham khảo) và kết quả ước lượng khi bạn bấm lưu vào lịch sử.
4. **Lịch sử trò chuyện AI:** Nội dung câu hỏi bạn gửi và câu trả lời của Trợ lý AI (lưu trong bảng `chatbot_history` để duy trì ngữ cảnh hội thoại và kiểm soát an toàn).
5. **Log kỹ thuật:** Nhật ký lỗi hệ thống và lượt chặn an toàn (guardrail), không lưu mật khẩu hoặc token đăng nhập.

## 3. Xử lý dữ liệu bởi bên thứ ba (Minh bạch về AI)
Tính năng Trợ lý giải đáp thông tin sử dụng hạ tầng mô hình ngôn ngữ bên thứ ba (**Groq Cloud API**):
- Khi bạn gửi tin nhắn trong khung chat, **nội dung tin nhắn** (cùng ngữ cảnh hội thoại gần nhất và **kết quả ước lượng gần nhất `latest_result`**, nếu có) sẽ được truyền qua kết nối mã hóa HTTPS tới máy chủ Groq để sinh câu trả lời.
- Chúng tôi **không** gửi mật khẩu, email hay số điện thoại của bạn sang Groq.
- Vì dữ liệu hội thoại đi qua máy chủ bên thứ ba, vui lòng **không nhập danh tính thật hoặc thông tin bệnh án mật** vào khung trò chuyện.

## 4. Mục đích sử dụng dữ liệu
Dữ liệu chỉ được dùng cho 3 mục đích phi thương mại:
1. Vận hành các tính năng trong thời gian trải nghiệm thử nghiệm.
2. Phân tích thống kê **ở dạng ẩn danh/tổng hợp** (ví dụ: tỷ lệ hoàn thành biểu mẫu, thời gian phản hồi, góp ý giao diện) để cải thiện sản phẩm và hoàn thiện hồ sơ kỹ thuật cá nhân (portfolio).
3. Kiểm soát an toàn và phòng ngừa lỗi hệ thống.

Chúng tôi cam kết **không bán, cho thuê hoặc chia sẻ dữ liệu cá nhân** cho bên quảng cáo hoặc bên thứ ba thương mại.

## 5. Thời hạn lưu trữ và xử lý sau đợt thử nghiệm
- Đợt trải nghiệm mở thử dự kiến kéo dài **3–4 ngày**.
- Sau khi kết thúc đợt thử nghiệm và hoàn tất tổng hợp số liệu ẩn danh (tối đa trong vòng **14 ngày**), **toàn bộ thông tin định danh tài khoản và dữ liệu sức khỏe cá nhân sẽ được xóa khỏi hệ thống**, chỉ giữ lại các chỉ số thống kê tổng hợp không thể truy ngược danh tính cá nhân.

## 6. Quyền của người tham gia
Bạn có toàn quyền:
- Xem lại lịch sử đánh giá và hồ sơ của mình trong ứng dụng.
- **Gửi yêu cầu xóa toàn bộ tài khoản và dữ liệu liên quan** kèm lý do bất kỳ lúc nào ngay trên trang Hồ sơ cá nhân hoặc qua email `tuannguyen2205@gmail.com`.
- Quản trị viên sẽ xem xét và **cam kết xóa hoàn toàn dữ liệu trong vòng 24 giờ** nếu không có vấn đề phát sinh.
