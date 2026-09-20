# Đăng nhập và chatbot local

## Các lỗi đã xác định ngày 20/09/2026

- `/login` lưu `token`, nhưng trang chẩn đoán đọc `access_token`, dẫn đến gửi `Bearer null` hoặc token cũ. Các màn hình FastAPI hiện dùng chung `lib/client-session.ts`; đăng nhập mới thay token cũ, còn phiên chỉ có khóa `token` vẫn hoạt động.
- `/register` chỉ trả trạng thái thành công, không cấp access token. Frontend trước đây ghi chuỗi `undefined` và chuyển vào trang chẩn đoán. Hiện đăng ký thành công chuyển đến đăng nhập.
- Kết nối Groq có lần báo `ConnectTimeout`. Khi kết nối được, model cũ `llama-3.3-70b-versatile` trả 404 và không xuất hiện trong danh sách model của tài khoản. `.env` local và cấu hình mẫu đã chuyển sang `openai/gpt-oss-20b`. Một completion thử không chứa dữ liệu sức khỏe đã thành công, khoảng 1,14 giây; đây không phải cam kết độ trễ cho mọi request.
- Model Random Forest và scaler lưu bằng scikit-learn 1.8.0, trong khi `.venv` dùng 1.5.2. Đã cài 1.8.0 vào `.venv` và ghim phiên bản này trong `api/requirements.txt`; kiểm tra load và inference đã qua, không còn `InconsistentVersionWarning`.

## Áp dụng vào tiến trình đang chạy

Thay đổi `.env` ở thư mục gốc và thư viện Python không đảm bảo được Uvicorn reload. Dừng Uvicorn bằng Ctrl+C, rồi chạy lại trong terminal đã activate `.venv`:

```powershell
# Nếu terminal đang ở E:\heart predict\api
uvicorn main:app --reload
```

Refresh trang trình duyệt để nạp mã frontend mới. Phiên `token` hợp lệ đang có được dùng tiếp. Nếu trước đó chỉ có token `undefined` hoặc token đã hết hạn thật, đăng xuất rồi đăng nhập một lần. Backend vẫn kiểm tra chữ ký và hạn JWT; không vô hiệu hóa xác thực.

## Timeout và đọc log

Timeout kết nối mặc định 10 giây, đọc 45 giây, toàn bộ lời gọi Groq tối đa 60 giây; frontend chờ tối đa 75 giây. Các biến `GROQ_*_TIMEOUT_SECONDS` trong `.env.example` cho phép chỉnh mà không sửa mã. Theo [HTTPX](https://www.python-httpx.org/advanced/timeouts/), timeout đọc giới hạn thời gian không nhận dữ liệu, nên backend đặt thêm deadline toàn bộ request.

Giới hạn phản hồi mặc định 768 completion tokens; ngữ cảnh lấy các tin gần nhất với tổng ngân sách 12.000 ký tự, giữ nguyên nội dung câu hỏi hiện tại. [Model GPT-OSS 20B trên Groq](https://console.groq.com/docs/model/openai/gpt-oss-20b) hỗ trợ mức reasoning khác nhau; ứng dụng dùng `low` cho hai model GPT-OSS được hỗ trợ trong cấu hình. Không tự retry completion để tránh gửi và tính phí trùng.

| Log backend | Ý nghĩa / hướng xử lý |
|---|---|
| `kind=ConnectTimeout` | Chưa thiết lập được kết nối tới Groq; kiểm tra mạng, DNS, proxy hoặc firewall. Tăng read timeout không sửa được đường truyền bị chặn. |
| `kind=ReadTimeout` | Đã kết nối nhưng chưa nhận đủ phản hồi trong thời hạn đọc. |
| `kind=TimeoutError` | Vượt deadline toàn bộ lời gọi. |
| `upstream_status=404` | Kiểm tra `GROQ_MODEL` trong danh sách model tài khoản đang được phép dùng. |
| `upstream_status=401` | Kiểm tra API key Groq; đây không phải JWT đăng nhập của người dùng. |
| `upstream_status=429` hoặc `kind=PoolTimeout` | Dịch vụ hoặc pool đang bận; UI trả lỗi tạm thời 503. |

Log có `request_id`, model, loại lỗi, status upstream và thời gian; không ghi API key, nội dung chat hay dữ liệu bệnh án. UI hiển thị lỗi riêng, giữ câu hỏi trong ô nhập khi thất bại, không đưa lỗi mạng thành câu trả lời của AI.

## `/predict` trả 422 và console hiện `[object Object]`

FastAPI trả lỗi validation dưới dạng danh sách object. Frontend hiện định dạng danh sách này thành tên trường và thông báo cụ thể. Miền `oldpeak` đã được đồng bộ thành `[-5, 10]`: form vốn cho phép số âm và dữ liệu UCI dùng huấn luyện có giá trị nhỏ nhất `-2.6`, trong khi schema cũ vô tình chỉ nhận số từ 0.

Chiều cao và cân nặng là tùy chọn nhưng phải được nhập cùng nhau để tính BMI. Khi để trống cả hai, frontend gửi `null` và `include_bmi=false`. Các chỉ số bắt buộc cũng được kiểm tra là số hữu hạn trước khi gửi, tránh biến `NaN` thành `null` trong JSON.

## Kiểm tra hồi quy

Từ thư mục gốc, trong `.venv`:

```powershell
python -m unittest discover -s tests -v
node --test tests/client-session.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Test xác nhận token do `/login` cấp dùng được cho `/predict`, token `null` vẫn bị từ chối, session mới thay session cũ, xử lý timeout/HTML 504, giới hạn thời gian gọi Groq và không lưu lịch sử khi AI thất bại. Các test này giả lập DB/Groq; kiểm tra kết nối thật ở trên được thực hiện riêng.
