# Nâng cấp hiệu năng và EDA

## Thay đổi đã triển khai

| Phần | Thay đổi | Mục đích |
|---|---|---|
| FastAPI | Route MySQL, bcrypt và inference dùng `def`; các đoạn DB trong chatbot chạy qua `run_in_threadpool` | Tránh chặn event loop bởi thư viện đồng bộ |
| Chatbot | Đóng kết nối DB trước khi gọi Groq; dùng chung `httpx.AsyncClient` trong lifespan | Giảm thời gian giữ DB connection, tái sử dụng HTTP connection |
| MySQL | Index `(user_id, timestamp, id)` cho lịch sử; `(user_id, role, timestamp)` cho đếm lượt chat; index email/phone | Hỗ trợ truy vấn đang có |
| Pool | `DB_POOL_SIZE=10`, giới hạn 1–32; trả 503 + Retry-After khi hết connection | Cấu hình theo tải và ngân sách kết nối |
| History API | `limit`, `offset`, tìm kiếm `q`; thứ tự timestamp + id | Giới hạn dữ liệu truyền và thứ tự nhất quán khi timestamp bằng nhau |
| Frontend | SWR cache trong RAM theo URL + token; tìm kiếm debounce 300 ms; prefetch khi hover/focus; invalidate sau lưu | Giảm request lặp và thời gian chờ khi chuyển trang |
| Bundle | Chatbot và dependency Markdown được tải khi mở chat | Giảm mã cần tải ban đầu trên trang chẩn đoán |
| CDN | `ASSET_PREFIX` tùy chọn khi build production | Cho phép phục vụ JS/CSS đã hash từ CDN |

FastAPI đã là framework hiện tại. Theo [tài liệu FastAPI](https://fastapi.tiangolo.com/async/), route `def` chạy trong thread pool; chỉ đổi sang `async def` khi các thao tác chờ bên trong có giao diện async phù hợp. Cách sửa này tăng khả năng phục vụ đồng thời, chưa chứng minh mỗi lần inference chạy nhanh hơn. Vẫn cần đo CPU, RAM và latency.

## Môi trường và kiểm tra

Dùng môi trường ảo của dự án trong PowerShell, từ `E:\heart predict`:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

Có thể thay `python` bằng `.\.venv\Scripts\python.exe` mà không cần activate. Bộ test dùng DB/Groq giả lập để kiểm tra phân trang, xác thực, tham số truy vấn, pool đầy, migration chạy lại, giải phóng DB trước network và health vẫn đáp ứng khi inference đang chờ. Đây không phải benchmark hệ thống triển khai.

Kiểm tra ngày 20/09/2026: 10/10 test backend đạt, TypeScript đạt và notebook chạy hết các cell trong `.venv`. Production build chưa hoàn tất vì `next/font/google` không tải được một số file Inter từ `fonts.gstatic.com`, kể cả khi thử lại với quyền truy cập mạng. Cần chạy lại build trên môi trường truy cập được Google Fonts trước khi triển khai.

## Áp dụng index

Database mới nhận index khi API tạo bảng. Database đã tồn tại cần chạy migration một lần sau khi bảng đã được khởi tạo, trước khi tăng số worker:

```powershell
python api/migrate_indexes.py
```

Script dùng `DB_*` từ `.env`, kiểm tra tên index trước khi tạo và có thể chạy lại. Chạy một tiến trình migration tại một thời điểm. Với bảng lớn, lên lịch phù hợp vì DDL có thể chờ khóa hoặc dùng tài nguyên đáng kể. Các index trong database đang triển khai chưa được áp dụng bởi lần sửa mã này.

Kiểm tra kế hoạch bằng `EXPLAIN`, thay `7` bằng ID tài khoản thử nghiệm có dữ liệu:

```sql
EXPLAIN SELECT id, name_prediction, prediction_result, risk_level, timestamp
FROM prediction_history WHERE user_id = 7
ORDER BY timestamp DESC, id DESC LIMIT 21 OFFSET 0;

EXPLAIN SELECT COUNT(*) FROM chatbot_history
WHERE user_id = 7 AND role = 'user'
AND timestamp >= NOW() - INTERVAL 1 HOUR;
```

Ghi lại index được chọn, số hàng ước tính và filesort trước/sau. Tìm kiếm chuỗi con và offset sâu vẫn có thể tốn chi phí; nếu đo thấy chậm, chuyển tiếp sang keyset pagination hoặc công cụ tìm kiếm phù hợp. Tổng connection budget xấp xỉ `workers × DB_POOL_SIZE`, cộng các client khác. Thread pool không làm tăng năng lực CPU vô hạn; tăng worker theo kết quả đo và RAM của model.

## Load test có thể chạy lại

Khởi động API với cấu hình thử nghiệm và dữ liệu đủ lớn. Dùng cùng model, dataset, máy, số worker và cấu hình DB khi so sánh trước/sau. Đầu tiên kiểm tra health, sau đó đo lịch sử và inference riêng:

```powershell
python scripts/load_test.py --scenario health --requests 200 --concurrency 10 --output reports/load-tests/health.json

# JWT lấy khi đăng nhập tài khoản thử nghiệm; không lưu token trong báo cáo.
$env:LOAD_TEST_TOKEN = '<JWT của tài khoản thử nghiệm>'
python scripts/load_test.py --scenario history --requests 500 --concurrency 10 --max-p95-ms 500 --output reports/load-tests/history.json
python scripts/load_test.py --scenario predict --payload scripts/predict_payload.json --requests 200 --concurrency 5 --max-p95-ms 1500 --output reports/load-tests/predict.json
```

Ngưỡng trên chỉ là ví dụ để thiết lập budget, chưa phải SLA đã đo. Công cụ warmup trước khi đo, xuất RPS, successful RPS, p50/p95/p99, mã HTTP, lỗi transport và tỷ lệ lỗi; exit 1 khi vượt ngưỡng, exit 2 khi không chạy được. Tăng concurrency lần lượt 1, 5, 10, 20; chạy mỗi mức 3 lần. Đây là tải với số request đồng thời cố định, không phải mô phỏng arrival rate độc lập. Dùng nhiều JWT riêng nếu cần mô phỏng nhiều người dùng. Không gọi chatbot trả phí hoặc ghi dữ liệu.

Theo dõi CPU/RAM API, slow-query log, số connection DB và network cùng lúc. Health nhanh nhưng predict chậm gợi ý kiểm tra inference/CPU; lịch sử chậm gợi ý kiểm tra kế hoạch truy vấn; nhiều 503 gợi ý pool bão hòa. Chưa có kết quả load test trên DB/API thật trong lần nâng cấp này.

## Cache, bundle và CDN

History GET vẫn trả mảng, mặc định 50 dòng, tối đa 100; dùng `offset` để lấy tiếp. UI lấy 21 dòng để hiển thị 20 dòng và xác định trang kế tiếp, không chạy thêm COUNT toàn bộ. Chat history trả 100 tin gần nhất theo thứ tự cũ đến mới; client khác có thể lấy trang cũ bằng `offset`, tối đa 200 tin/request. UI chatbot hiện chỉ hiển thị 100 tin gần nhất.

[SWR preload](https://swr.vercel.app/docs/prefetching) dùng để tải lịch sử khi hover/focus menu và trang sau; dữ liệu cũ được revalidate khi mở lại trang hoặc focus. Cache nằm trong RAM trình duyệt, phân biệt bằng token và URL, không ghi dữ liệu bệnh án vào localStorage. Logout xóa token và reload trang. API lịch sử dùng `Cache-Control: private, no-store`; chưa bật shared server cache, tránh cache dùng chung giữa tài khoản và bài toán invalidation đa worker.

Next.js tiếp tục xử lý tree-shaking và tách mã theo route trong production. Đo trang `/diagnosis` bằng Network/Lighthouse với cache trình duyệt tắt: trước khi mở chatbot chưa tải chunk chứa Markdown; sau lần mở đầu tiên chunk được tải. So sánh transferred JS, LCP/INP trên cùng môi trường. Chưa có số đo bundle trước/sau để công bố phần trăm cải thiện.

Theo [tài liệu assetPrefix](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix), cấu hình này áp dụng cho tài nguyên Next.js dưới `/_next/static`. Nếu dùng CDN riêng:

1. Đặt `ASSET_PREFIX=https://<cdn-domain>` trước `npm.cmd run build`.
2. Upload nội dung `.next/static/` vào `/_next/static/` của CDN, giữ nguyên tên có hash.
3. Phục vụ file đã hash với cache immutable; giữ asset bản trước trong quá trình rollout.
4. Kiểm tra URL JS/CSS trên CDN trả 200 và đúng content type trước khi đưa frontend mới vào sử dụng.

Không đặt `ASSET_PREFIX` khi chưa có CDN. File `public/` cần URL/CDN riêng nếu bổ sung sau. CDN chưa được provision/deploy trong lần sửa này.

## Khi nào cần bước nâng cấp tiếp theo

Các truy vấn hiện tại dùng SQL tham số hóa, chỉ chọn cột cần thiết và không có ORM/N+1. Thêm SQLAlchemy/Prisma chỉ để bọc lại các truy vấn này chưa có lợi ích được đo. Có thể chuyển driver async nếu profiling cho thấy thread pool là giới hạn.

Chưa có endpoint báo cáo tổng hợp nặng để tạo materialized view/precomputed table. Khi xuất hiện, đo chi phí GROUP BY trước, rồi chọn bảng tổng hợp theo ngày và nguồn, có `refreshed_at`, khóa unique theo chiều báo cáo và job cập nhật lặp lại được. MySQL không có materialized view native; cần bảng tổng hợp và cơ chế refresh. Không dùng số liệu tổng hợp trễ cho quyết định cần dữ liệu hiện thời.

Dữ liệu EDA hiện có 920 dòng, chưa tạo nhu cầu BigQuery/Spark. Chỉ cân nhắc khi workload phân tích vượt tài nguyên xử lý hiện tại hoặc phải tổng hợp nhiều nguồn lớn, sau khi so sánh chi phí ETL, độ trễ cập nhật và vận hành. DB engine, ORM và kho dữ liệu giữ theo kiến trúc hiện có trong bước này.

## Notebook EDA

```powershell
python -m pip install -r notebook/requirements-eda.txt
python scripts/run_eda.py
```

Mở `notebook/heart_disease_eda.ipynb` và chọn interpreter `.venv\Scripts\python.exe` trong editor, hoặc dùng script trên để chạy kernel bằng đúng interpreter hiện tại. Kết quả ở `notebook/eda_outputs/`, gồm bản notebook đã chạy, CSV thống kê/missing/duplicates metadata, PNG histogram/boxplot/correlation, JSON có SHA-256 nguồn và phiên bản thư viện, snapshot CSV, preprocessor và ma trận train/test minh họa. Thư mục output được gitignore và có thể tái tạo.

Pipeline minh họa tách train/test trước khi fit imputer/scaler/encoder và ngưỡng IQR; loại ID, `num` và nguồn khỏi feature. Outlier được gắn cờ, không tự xóa. Artifact EDA không thay thế model/scaler trong `models/`. Kết quả chạy: 920 dòng, 16 cột, 2 dòng trùng nội dung khi bỏ ID, không thiếu target; split sau loại trùng gồm 734 train và 184 test.
