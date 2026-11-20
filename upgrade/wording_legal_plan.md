# Plan điều chỉnh: điều khoản pháp lý và ngôn ngữ kiểu trang y tế

> [!NOTE]
> Mình đã rà các câu chữ thật trong code để lập plan này. Chưa sửa gì. Mình không phải luật sư; nên nhờ giảng viên hoặc chuyên gia pháp lý rà bản điều khoản cuối.

## 1. Phát hiện từ việc rà code (những chỗ cần sửa nhất)

| # | Vị trí | Hiện trạng | Rủi ro |
|---|---|---|---|
| 1 | [predictions.py:16-26](file:///e:/heart%20predict/api/app/routers/predictions.py#L16-L26) | "Tuyệt vời! ... mức THẤP **(An toàn)**", "Hệ thống **phát hiện** nguy cơ CAO", "**CẢNH BÁO** ... **ngay lập tức**", "chỉ số lâm sàng **rất ổn định**" | Khẳng định và gây hoang mang; dễ bị cắt clip |
| 2 | [predictions.py:179](file:///e:/heart%20predict/api/app/routers/predictions.py#L179) | "Đã lưu lịch sử **chẩn đoán**" | Dùng từ chẩn đoán |
| 3 | [multi-step-form.tsx:136](file:///e:/heart%20predict/components/diagnosis/multi-step-form.tsx#L136) | "...thực hiện **chẩn đoán**" | như trên |
| 4 | [result-display.tsx:132-162](file:///e:/heart%20predict/components/diagnosis/result-display.tsx#L132-L162) | "Chỉ số **an toàn** tim mạch", "0% (**An toàn**)", "so với tỷ lệ **khỏe**", "nên theo dõi kỹ hơn" | "An toàn/khỏe" ngụ ý kết luận |
| 5 | [context.tsx:51-60](file:///e:/heart%20predict/lib/i18n/context.tsx#L51-L60) | "Dự đoán bệnh tim mạch", "Dự đoán ngay", "Kết quả dự đoán", "Xác suất" | Nghe như dự đoán bệnh |
| 6 | [chatbot.py:115](file:///e:/heart%20predict/api/app/routers/chatbot.py#L115) | System prompt: "trợ lý AI chuyên về **tư vấn** phòng ngừa..., luôn khuyên đi khám khi có **dấu hiệu nặng**" | Quá ngắn: không cấm thuốc/liều, không cấm khẳng định bệnh |
| 7 | [chatbot.py:20](file:///e:/heart%20predict/api/app/routers/chatbot.py#L20) | `HOURLY_LIMIT = 20` cứng, và lỗi nói "**tư vấn**/giờ"; UI nói 5 hoặc 10 tùy cấu hình | Không nhất quán; dùng từ tư vấn |
| 8 | [chatbot.py:112-129](file:///e:/heart%20predict/api/app/routers/chatbot.py#L112-L129) | Không có lớp lọc trước/sau LLM; nội dung chat lưu nguyên văn | Cần guardrail và nêu rõ trong điều khoản |
| 9 | Chatbot nhận `latest_result` ở [HeartChatbot.tsx:167](file:///e:/heart%20predict/components/chatbot/HeartChatbot.tsx#L167) | Kết quả đánh giá có thể được gửi sang Groq | Phải nêu trong điều khoản bên thứ ba |
| 10 | [page.tsx:48](file:///e:/heart%20predict/app/page.tsx#L48), [result-display.tsx:237](file:///e:/heart%20predict/components/diagnosis/result-display.tsx#L237), [assessment-actions.tsx:74](file:///e:/heart%20predict/components/diagnosis/assessment-actions.tsx#L74) | Đã có câu "tham khảo, không thay thế chẩn đoán của bác sĩ" | **Tốt**, nhưng nhỏ chữ và chưa có ở khung chat; nên chuẩn hóa thành 1 component |
| 11 | Premium/QR (trang hồ sơ) | Vẫn còn theo README | Ẩn trong pilot (chưa tìm thấy vị trí chính xác khi rà; cần xác nhận) |

---

## 2. Phong cách ngôn ngữ mới ("giống trang bác sĩ")

### 2.1 Nguyên tắc viết
1. **Mô tả, không kết luận:** "ước lượng", "gợi ý", "tham khảo" thay cho "phát hiện", "bạn bị", "an toàn".
2. **Không dùng từ tuyệt đối:** bỏ "tuyệt vời", "rất ổn", "an toàn", "khỏe mạnh", "ngay lập tức", "chắc chắn".
3. **Luôn kèm giới hạn:** "dựa trên dữ liệu bạn nhập và mô hình nghiên cứu".
4. **Hướng hành động trung tính:** "Bạn có thể cân nhắc trao đổi với bác sĩ" thay cho "Bạn cần đến cơ sở y tế".
5. **Ngoại lệ có chủ đích:** triệu chứng cấp (đau ngực, khó thở, ngất) thì **được phép** nói dứt khoát "gọi 115", vì đây là an toàn người dùng, không phải kết luận về mô hình.
6. **Giọng điệu:** bình tĩnh, tôn trọng, không cảm thán, không emoji trong kết quả.
7. **Thay từ khóa chuẩn:**

| Hiện tại | Đề xuất |
|---|---|
| Chẩn đoán | Đánh giá tham khảo / Ước lượng nguy cơ |
| Dự đoán bệnh tim mạch | Ước lượng nguy cơ tim mạch (nghiên cứu) |
| Dự đoán ngay | Xem ước lượng |
| Xác suất | Mức ước lượng của mô hình |
| An toàn / Khỏe | Mức thấp hơn / Gần với nhóm tham chiếu |
| Tư vấn (chatbot) | Giải đáp thông tin |
| Kết quả | Kết quả tham khảo |
| Bệnh nhân | Người tham gia / Người dùng |

### 2.2 Mẫu viết lại thông điệp kết quả (đề xuất, để bạn chỉnh)

| Mức | Hiện tại | Đề xuất |
|---|---|---|
| THẤP | "Tuyệt vời! ... mức THẤP (An toàn)." | "Với các chỉ số bạn đã nhập, mô hình nghiên cứu ước lượng nguy cơ ở mức thấp. Điều này không loại trừ các vấn đề sức khỏe khác. Nếu có triệu chứng bất thường hoặc lo ngại, bạn nên trao đổi với bác sĩ." |
| TRUNG BÌNH | "Hãy chú ý duy trì lối sống lành mạnh..." | "Mô hình ước lượng nguy cơ ở mức trung bình. Bạn có thể cân nhắc duy trì lối sống lành mạnh và trao đổi với bác sĩ về việc theo dõi định kỳ." |
| CAO | "Hệ thống phát hiện... bạn nên đến gặp bác sĩ sớm" | "Mô hình ước lượng nguy cơ ở mức cao theo dữ liệu nhập. Đây chỉ là ước lượng tham khảo, không phải kết luận. Bạn nên cân nhắc trao đổi sớm với bác sĩ để được đánh giá đầy đủ." |
| RẤT CAO | "CẢNH BÁO... ngay lập tức" | "Mô hình ước lượng nguy cơ ở mức rất cao theo dữ liệu nhập. Đây không phải kết luận y khoa. Bạn nên sớm trao đổi với bác sĩ. Nếu đang đau ngực, khó thở hoặc ngất, hãy gọi 115." |
| Điểm lâm sàng thấp | "rất ổn định... phong độ" | "Điểm tham khảo ở mức thấp. Chỉ số đơn lẻ không phản ánh toàn bộ tình trạng sức khỏe." |

Giữ nhãn màu (xanh/vàng/đỏ) nhưng đổi chữ nhãn sang **"Mức thấp / trung bình / cao / rất cao (ước lượng)"**; xem xét thay đỏ đậm bằng cam để giảm hoảng sợ.

### 2.3 Giao diện kiểu trang y tế
- Màu trung tính (xanh dương/trắng/xám), giảm nhấn đỏ/xanh lá "đậm" dễ hiểu như phán quyết.
- Khối **"Giới hạn của công cụ"** dưới kết quả (thu gọn được): dữ liệu huấn luyện UCI (920 ca, dân số khác Việt Nam), không thay xét nghiệm.
- **"Điều bạn có thể làm tiếp theo"**: danh sách trung tính (mang kết quả hỏi bác sĩ; chuẩn bị thông tin).
- Trang **Giới thiệu & Phương pháp** (nguồn dữ liệu, mô hình, độ chính xác, hạn chế) cho giống cổng thông tin khoa học.
- Trang **Liên hệ & Quyền dữ liệu**, **Người thực hiện** (tên, đơn vị/giảng viên hướng dẫn) tăng độ tin cậy.
- Footer cố định: *"Công cụ nghiên cứu học thuật. Không thay thế bác sĩ. Cấp cứu: 115."*

---

## 3. Điều khoản pháp lý đưa vào đồ án

### 3.1 Bộ tài liệu (viết trước, lưu version)
1. **Điều khoản sử dụng** (phạm vi, đối tượng ≥18, cấm dùng thay bác sĩ).
2. **Chính sách dữ liệu / quyền riêng tư** (thu gì, để làm gì, ai xử lý, lưu bao lâu, quyền xóa).
3. **Phiếu đồng ý tham gia nghiên cứu** (tự nguyện, mục đích, rủi ro, quyền rút lui).
4. **Tuyên bố hạn chế mô hình** (một trang, dùng chung cho web và báo cáo).
5. **Đề cương nghiên cứu 1–2 trang** (đưa vào phụ lục đồ án).

### 3.2 Nội dung bắt buộc (khớp với những gì code thật đang làm)
- Dữ liệu thu: tài khoản, chỉ số nhập, **lịch sử đánh giá**, **nội dung chat** (lưu trong `chatbot_history`).
- Bên thứ ba: **Groq** nhận nội dung chat và có thể nhận **kết quả đánh giá gần nhất** (`latest_result`). Ghi rõ.
- Thời gian lưu và xử lý sau pilot (xóa hoặc ẩn danh).
- Hạn mức sử dụng chatbot (thống nhất một con số).
- Không thu phí; không phải thiết bị y tế.
- Liên hệ + thời hạn xử lý yêu cầu xóa.

### 3.3 Đưa vào đồ án
- Mục **"Đạo đức nghiên cứu & Pháp lý"** trong báo cáo: tóm tắt các văn bản trên, sơ đồ luồng consent, danh sách guardrail.
- Mục **"Hạn chế và hướng phát triển"**: domain shift, cần external validation, IRB, khung pháp lý thiết bị y tế (SaMD).
- Phụ lục: điều khoản, prompt, từ khóa guardrail, kết quả red-team, ảnh chụp banner.
- Nếu có giảng viên hướng dẫn: ghi tên và xin xác nhận bằng văn bản ngắn.

---

## 4. Danh sách thay đổi kỹ thuật

### Giai đoạn A: Nội dung và văn bản (không cần code phức tạp)
1. Soạn 5 tài liệu ở mục 3.1 (tiếng Việt; EN tùy chọn vì app có i18n).
2. Chốt từ điển thuật ngữ (bảng 2.1) và 5 thông điệp kết quả (bảng 2.2).
3. Nhờ 2–3 người ngoài đọc thử, ghi lại chỗ khó hiểu.

### Giai đoạn B: Sửa chữ trong code (rủi ro thấp)
1. Backend: sửa `AI_MESSAGES`, `CLINICAL_MESSAGES`, câu "chẩn đoán" ở predictions.py.
2. Frontend: `result-display.tsx`, `multi-step-form.tsx`, `context.tsx` (VI và EN), `page.tsx`, `assessment-actions.tsx` (PDF).
3. Gom câu miễn trừ thành **một component** dùng chung (trang chủ, form, kết quả, PDF, chat).
4. Đổi nhãn "An toàn/Khỏe" trong biểu đồ so sánh thành mô tả trung tính.
5. Đổi tên hiển thị: "Dự đoán" thành "Ước lượng nguy cơ" nhất quán, kể cả tiêu đề tab/metadata ở `layout.tsx`.

### Giai đoạn C: Consent và pháp lý trong app
1. Trang `/terms`, `/privacy`, `/about-method`, `/contact` (hoặc một trang có anchor).
2. Form đăng ký: tóm tắt 5 dòng + checkbox không tick sẵn + link toàn văn (file [register-form-api.tsx](file:///e:/heart%20predict/components/auth/register-form-api.tsx)).
3. Backend: kiểm tra consent trong [users.py](file:///e:/heart%20predict/api/app/routers/users.py); thêm cột `terms_version`, `accepted_at`, `age_confirmed`, `research_consent` (migration kiểu `migrate_indexes.py`).
4. Chấp nhận lại điều khoản khi version đổi.
5. Nút xóa tài khoản và dữ liệu; email liên hệ.
6. Ẩn Premium/QR, thống nhất hạn mức chat (đọc `FREE_CHAT_LIMIT` từ config thay vì `HOURLY_LIMIT = 20` cứng).

### Giai đoạn D: An toàn chatbot
1. **Viết lại system prompt** (thay [chatbot.py:115](file:///e:/heart%20predict/api/app/routers/chatbot.py#L115)) gồm: vai trò "giải đáp thông tin", cấm đề xuất/điều chỉnh thuốc và liều, cấm khẳng định có/không bệnh, giọng trung tính, khuyên trao đổi với bác sĩ, từ chối yêu cầu đóng vai bác sĩ/bỏ qua hướng dẫn, cấp cứu thì nêu 115.
2. **Lọc đầu vào** (từ khóa thuốc/liều/cấp cứu/chẩn đoán, có xử lý không dấu) trả câu cố định, không gọi LLM.
3. **Lọc đầu ra**: quét cụm nguy hiểm, thay bằng câu an toàn.
4. Footer miễn trừ ngắn mỗi câu trả lời; thông báo ở màn hình chào (thay đoạn ở [HeartChatbot.tsx:241-244](file:///e:/heart%20predict/components/chatbot/HeartChatbot.tsx#L241-L244)).
5. Đổi chữ "tư vấn" thành "giải đáp" ở lỗi và UI.
6. Cờ `CHATBOT_DISABLED` làm kill switch.

### Giai đoạn E: Kiểm thử và hồ sơ
1. Test: không đăng ký được nếu chưa consent (UI và API); guardrail; câu kết quả không còn từ cấm.
2. **Script quét từ cấm** trong toàn bộ `app/`, `components/`, `lib/`, `api/` (danh sách: "chẩn đoán", "an toàn", "khỏe mạnh", "tuyệt vời", "ngay lập tức", "phát hiện"...) chạy trong CI/test.
3. Red-team chatbot ≥ 50 câu; ghi kết quả.
4. Cập nhật `scripts/check-ui.cjs` cho các câu chữ mới (hiện đang tìm các nhãn cụ thể như "Xem kết quả đánh giá").
5. Quay lại video demo bằng script đã có (nhớ sửa lời thoại cho khớp ngôn ngữ mới; cảnh Lịch sử cần chờ tải xong).

---

## 5. Thứ tự đề xuất và ước lượng

| Bước | Nội dung | Ước lượng |
|---|---|---|
| 1 | Giai đoạn A (văn bản, từ điển) | 1–2 ngày |
| 2 | Giai đoạn B (sửa chữ) | 0,5–1 ngày |
| 3 | Giai đoạn D (chatbot an toàn) | 1–1,5 ngày |
| 4 | Giai đoạn C (consent, trang pháp lý, ẩn Premium) | 1,5–2 ngày |
| 5 | Giai đoạn E (test, red-team, hồ sơ, video mới) | 1–1,5 ngày |

Tổng ≈ 5–8 ngày. Nên làm **A → B → D → C → E**: chữ và chatbot giảm rủi ro nhanh nhất; consent làm sau khi văn bản đã chốt.

---

## 6. Điểm cần cân nhắc (quyết định của bạn)

1. **Đổi tên sản phẩm?** "HeartGuard" (bảo vệ tim) hơi mang tính cam kết. Có thể thêm phụ đề "Công cụ nghiên cứu ước lượng nguy cơ tim mạch".
2. **Mức độ ít khẳng định vs. hữu ích:** quá mơ hồ thì người dùng thấy vô ích. Gợi ý giữ con số xác suất nhưng đặt sau cụm "ước lượng của mô hình".
3. **Biểu đồ "so với tỷ lệ khỏe trong tập khảo sát" (44,7%)**: dễ bị hiểu sai là so với dân số. Cân nhắc đổi thành thông tin phương pháp hoặc ẩn trong pilot.
4. **Có bảo trợ học thuật** (giảng viên/khoa) không? Rất nên, và ghi vào trang Giới thiệu.
5. **Dữ liệu thật hay ca mẫu** làm mặc định?
6. **Ngôn ngữ EN:** giữ đồng bộ song ngữ hay chỉ VI trong pilot (tiết kiệm công)?

> [!IMPORTANT]
> Chỉ sửa chữ **không đủ**: cần kết hợp guardrail chatbot, consent lưu bằng chứng, ẩn Premium và hồ sơ đề cương. Nếu bạn đồng ý, bước đầu tiên mình có thể làm ngay là Giai đoạn B + D (sửa chữ và chatbot an toàn), vì rủi ro thấp và không phụ thuộc văn bản pháp lý.
