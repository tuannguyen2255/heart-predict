# HeartGuard — Giao diện và tính năng mới

Cập nhật: 20/09/2026. Tài liệu này tách phần đã triển khai và phần đề xuất để tham khảo phát triển tiếp.

## 1. Định hướng giao diện đã áp dụng

Phong cách cổng thông tin sức khỏe: rõ ràng, gọn, phù hợp nội dung tiếng Việt. Đây là lựa chọn thiết kế của dự án, không phải bộ nhận diện của cơ sở y tế hay tiêu chuẩn chính thức.

| Thành phần | Lựa chọn |
| --- | --- |
| Màu chính | Xanh dương y tế, HSL 205 / 86% / 33% (gần #0c619d) |
| Màu phụ | Xanh ngọc, dùng cho biểu tượng và nhãn mục |
| Nền | Trắng và xám xanh nhạt |
| Trạng thái | Xanh lá, vàng, cam, đỏ đi kèm nhãn chữ; lỗi có thông báo cụ thể |
| Kiểu chữ | Font hệ thống hỗ trợ tiếng Việt, không cần tải Google Fonts |
| Bố cục | Khoảng trắng vừa phải, viền mảnh, góc bo nhỏ, hạn chế đổ bóng |
| Điện thoại | Menu thu gọn, biểu mẫu một cột, lịch sử dạng danh sách, chatbot vừa màn hình |

Các trang đã đồng bộ: trang chủ, đăng nhập, đăng ký, đánh giá, kết quả, lịch sử, hồ sơ và khung chatbot.

- Trang chủ có lối vào ba tác vụ chính, danh sách thông tin cần chuẩn bị và hướng dẫn mở/đóng.
- Loại bỏ dashboard minh họa với nhịp tim, huyết áp, tỷ lệ tăng trưởng không lấy từ dữ liệu thật.
- Thương hiệu hiển thị “HeartGuard”; giảm khẩu hiệu và nhãn AI trang trí.
- Chatbot hiển thị “Trợ lý sức khỏe”, có mô tả phản hồi tự động.
- Nội dung “Đồ án HK 8” không còn trong mã giao diện.

## 2. Tính năng mới đã triển khai

### Lấy thông tin từ hồ sơ

Vào **Đánh giá nguy cơ → Lấy thông tin từ hồ sơ**.

- Đọc hồ sơ qua API hiện có, dùng phiên đăng nhập.
- Điền tuổi, giới tính, chiều cao, cân nặng, huyết áp và cholesterol vào các ô còn trống.
- Không ghi đè thông tin người dùng đã nhập.
- Bỏ qua giá trị thiếu, không phải số hoặc ngoài giới hạn biểu mẫu.
- Có trạng thái đang tải và thông báo lỗi. Người dùng kiểm tra lại chỉ số trước khi gửi.
- Hồ sơ hiện chưa có ngày đo từng chỉ số; chưa thể đánh giá độ mới của dữ liệu.

### Kiểm tra dữ liệu theo từng bước

- Kiểm tra khoảng giá trị trước khi chuyển bước và trước khi gọi API.
- Chiều cao/cân nặng phải nhập cùng nhau hoặc cùng để trống.
- Tuổi phải lớn hơn 0 để phép tính huyết áp/tuổi không chia cho 0.
- Chấp nhận oldpeak âm theo hợp đồng API hiện tại, gồm -2.6; giá trị 0 hợp lệ.
- Yêu cầu chọn giới tính thay vì tự chọn sẵn.
- Các giới hạn này là giới hạn nhập liệu của ứng dụng, **không phải khoảng chỉ số sức khỏe bình thường**.

### Lưu kết quả vào lịch sử

Sau khi đánh giá, chọn **Lưu vào lịch sử**.

- Lưu tên lần đánh giá, phân loại, giá trị mô hình, điểm lâm sàng và mức nguy cơ qua API hiện có.
- Dùng bản chụp dữ liệu tại thời điểm gửi: sửa biểu mẫu sau đó không làm đổi tên/nội dung kết quả cũ.
- Khóa nút trong khi lưu và sau khi lưu thành công để tránh nhấp lặp trong cùng lần đánh giá.
- Nếu API báo lỗi, hiển thị nguyên nhân và cho thử lại.
- Làm mới cache lịch sử và cung cấp liên kết xem bản ghi.
- Đây là chống nhấp lặp ở giao diện; backend chưa có khóa idempotency. Nếu phản hồi bị mất sau khi server đã ghi, thử lại vẫn có thể tạo bản ghi trùng.

### In phiếu / lưu PDF

Chọn **In / lưu PDF**, sau đó chọn máy in hoặc **Save as PDF / Lưu dưới dạng PDF** trong hộp thoại trình duyệt.

- Phiếu gồm thời gian đánh giá, tên lần đánh giá, các thông tin đã gửi, kết quả và BMI nếu có.
- Bản in sử dụng đúng dữ liệu đã gửi, kể cả khi biểu mẫu đã được sửa.
- Ẩn menu, biểu mẫu và chatbot khi in; bố cục A4.
- Tạo bản in trên thiết bị, không tải PDF lên dịch vụ bên ngoài.
- Phiếu chỉ còn khả dụng khi kết quả vẫn ở trang hiện tại; tải lại trang sẽ mất trạng thái chưa lưu.

### Lịch sử trên điện thoại

- Hiển thị từng bản ghi với tên, thời gian, mức nguy cơ và phân loại mô hình.
- Bảng đầy đủ vẫn dùng trên màn hình lớn.
- Giữ tìm kiếm và phân trang đã có.

## 3. Giới hạn hiện tại cần biết

- Bảng lịch sử hiện chưa lưu toàn bộ đầu vào và phiên bản mô hình. Vì vậy chưa thể mở lại phiếu đầy đủ hoặc dựng biểu đồ huyết áp/cholesterol từ các bản ghi cũ.
- Thông tin biểu mẫu và bản chụp phục vụ in được giữ trong bộ nhớ trang; không thêm cơ chế tự lưu dữ liệu sức khỏe vào localStorage.
- Hồ sơ, lịch sử và một phần chatbot vẫn có nội dung tiếng Việt cố định. Trang chủ và các tính năng đánh giá mới hỗ trợ VI/EN; đồng bộ ngôn ngữ toàn ứng dụng là việc tiếp theo.
- Thiết kế giao diện không xác nhận độ chính xác y khoa của mô hình.
- Cần rà soát riêng logic mô hình: hiện `api/app/ml.py::run_inference` trả xác suất của **lớp được dự đoán** bằng `predict_proba(...)[0][prediction]`, trong khi mức nguy cơ được suy từ giá trị đó. Chưa thay đổi thuật toán ở đợt giao diện này. Nhãn mới dùng “Giá trị mô hình trả về”; không diễn giải thành tỷ lệ mắc bệnh đã được kiểm chứng.
- `clinical_evaluation.risk_level` hiện dùng lại mức nguy cơ của mô hình. Cần đánh giá lại cách tính và cách diễn giải trước khi dùng ngoài phạm vi demo.

## 4. Hướng phát triển đề xuất — chưa triển khai

| Ưu tiên | Hạng mục | Giá trị sử dụng | Việc cần bổ sung |
| --- | --- | --- | --- |
| P0 | Rà soát xác suất và mức nguy cơ | Tránh diễn giải sai kết quả | Kiểm tra classes_, xác suất lớp bệnh, trường hợp dự đoán âm/dương; kiểm định trên tập độc lập và rà soát chuyên môn |
| P1 | Chi tiết từng lần đánh giá | Mở lại, in lại và đối chiếu thông tin | Lưu đầu vào, thời điểm đo, phiên bản mô hình; API chi tiết; phân quyền theo người dùng |
| P1 | Chống lưu trùng ở server | Thử lại an toàn khi mất mạng | Khóa idempotency, unique index theo người dùng/lần đánh giá |
| P1 | Biểu đồ chỉ số theo thời gian | Theo dõi thay đổi từ dữ liệu thực | Mốc đo, đơn vị thống nhất, bảng measurements; không tạo xu hướng từ dữ liệu minh họa |
| P1 | Ngôn ngữ và khả năng tiếp cận | Dùng nhất quán, thuận tiện bằng bàn phím | Đưa chuỗi cố định vào i18n, kiểm tra screen reader và độ tương phản toàn bộ trạng thái |
| P2 | Nhắc cập nhật chỉ số | Hỗ trợ theo dõi định kỳ | Người dùng chủ động bật/tắt, lịch nhắc và lựa chọn kênh thông báo |
| P2 | Chia sẻ phiếu có thời hạn | Gửi thông tin khi cần trao đổi | Đồng ý chia sẻ, liên kết có hạn, thu hồi, nhật ký truy cập |
| P2 | Giải thích các trường xét nghiệm | Giảm nhập nhầm dữ liệu | Nội dung được duyệt chuyên môn, nguồn và ngày cập nhật; không tự suy diễn giá trị còn thiếu |
| P3 | Đặt lịch với cơ sở y tế | Nối tiếp từ theo dõi sang thăm khám | Đối tác thật, lịch trống thật, quy trình xác nhận và hủy; hiện chưa có nút đặt lịch giả lập |

Đề xuất làm P0 trước, sau đó P1 theo thứ tự: lưu chi tiết → chống trùng → biểu đồ chỉ số.

## 5. Kiểm tra và xem lại

Kết quả kiểm tra đợt này: build thành công; 13 kiểm tra JavaScript và 20 kiểm tra Python đạt. Kiểm tra Edge headless với API giả lập đạt; trang chủ và đánh giá được kiểm tra độ rộng 320, 768, 1024, 1440px, lịch sử/hồ sơ ở 320 và 390px. Đã xem ảnh chụp desktop/mobile và xuất PDF mẫu.

- Production build và TypeScript: `npm run build`.
- Kiểm tra JavaScript: `node --test tests/client-session.test.cjs tests/assessment.test.cjs`.
- Backend dùng đúng môi trường: `.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"`.
- Kiểm tra trình duyệt: `scripts/check-ui.cjs`, dùng Edge headless và API giả lập; không ghi dữ liệu vào database thật.
- Ảnh kiểm tra và PDF mẫu được xuất vào `reports/ui/` (được gitignore). Các chỉ số trong ảnh đánh giá là dữ liệu kiểm thử, không phải kết quả của người dùng.

Chạy lại kiểm tra trình duyệt khi có Playwright:

```powershell
# Terminal 1
npm run build
npm run start -- --port 3011

# Terminal 2: cần module playwright có sẵn.
# Nếu cài ở vị trí riêng, đặt PLAYWRIGHT_MODULE thành đường dẫn module.
node scripts/check-ui.cjs
```

API giả lập kiểm tra: điền hồ sơ không ghi đè, dữ liệu sai khoảng, oldpeak âm, lỗi lưu và thử lại, trạng thái đã lưu, bản chụp đầu vào, in PDF, menu mobile, chatbot, lịch sử và hồ sơ.
