# Từ điển Thuật ngữ & Bộ Thông điệp Chuẩn (Wording Guide)

Tài liệu này quy chuẩn cách dùng từ trong toàn bộ mã nguồn Frontend (`app/`, `components/`, `lib/i18n/`) và Backend (`api/app/routers/`) để giọng điệu giống các cổng thông tin sức khỏe đáng tin cậy: **trung tính, mô tả, không khẳng định y khoa, không gây hoang mang**.

---

## 1. Bảng thay thế từ khóa bắt buộc

| Từ cũ (cần bỏ/sửa) | Từ mới (chuẩn hóa) | Ghi chú |
|---|---|---|
| Chẩn đoán | Đánh giá tham khảo / Ước lượng nguy cơ | Tuyệt đối không dùng "chẩn đoán" cho chức năng của web |
| Dự đoán bệnh tim mạch | Ước lượng nguy cơ tim mạch (tham khảo) | Giảm cảm giác "phán bệnh" |
| Dự đoán ngay | Xem ước lượng tham khảo | Nút bấm submit |
| Kết quả dự đoán | Kết quả ước lượng tham khảo | Tiêu đề kết quả |
| Hệ thống phát hiện… | Mô hình ước lượng… | Tránh ngụ ý đã phát hiện bệnh lý |
| An toàn / Khỏe mạnh | Mức nguy cơ ước lượng thấp / Gần nhóm tham chiếu | Không khẳng định người dùng "an toàn" |
| Tuyệt vời! / Phong độ | *(Bỏ hoàn toàn cảm thán)* | Giữ giọng trung tính, điềm tĩnh |
| CẢNH BÁO! … ngay lập tức | Mức ước lượng rất cao — nên sớm trao đổi với bác sĩ | Chỉ dùng "gọi 115" khi có triệu chứng cấp |
| Tư vấn (Chatbot) | Giải đáp thông tin | Tránh nhầm với "tư vấn khám chữa bệnh" |
| Bệnh nhân | Người dùng / Người tham gia | Trừ khi nhắc tới bộ dữ liệu gốc UCI |

---

## 2. Bộ 5 thông điệp kết quả chuẩn (dùng cho `api/app/routers/predictions.py`)

### A. `AI_MESSAGES`
- **`THẤP`:**
  > "Dựa trên các chỉ số bạn đã nhập, mô hình nghiên cứu ước lượng nguy cơ ở mức thấp. Đây chỉ là thông tin tham khảo và không loại trừ các vấn đề sức khỏe tiềm ẩn. Nếu có triệu chứng bất thường hoặc lo ngại, bạn nên trao đổi với bác sĩ."
- **`TRUNG BÌNH`:**
  > "Dựa trên dữ liệu nhập vào, mô hình ước lượng nguy cơ ở mức trung bình. Bạn có thể cân nhắc duy trì lối sống lành mạnh và trao đổi với bác sĩ về kế hoạch theo dõi sức khỏe định kỳ."
- **`CAO`:**
  > "Dựa trên dữ liệu nhập vào, mô hình ước lượng nguy cơ ở mức cao. Đây là kết quả tham khảo từ mô hình nghiên cứu, không phải kết luận y khoa. Bạn nên cân nhắc trao đổi sớm với bác sĩ chuyên khoa để được đánh giá đầy đủ."
- **`RẤT CAO`:**
  > "Dựa trên dữ liệu nhập vào, mô hình ước lượng nguy cơ ở mức rất cao. Đây không phải kết luận y khoa; bạn nên sớm trao đổi với bác sĩ chuyên khoa. Nếu đang có triệu chứng như đau ngực, khó thở hoặc ngất, hãy gọi cấp cứu 115 ngay."

### B. `CLINICAL_MESSAGES`
- **`THẤP`:**
  > "Điểm tham khảo lâm sàng hiện ở mức thấp theo các chỉ số đã nhập. Các chỉ số đơn lẻ không phản ánh toàn bộ tình trạng sức khỏe tổng thể."
- **`TRUNG BÌNH`:**
  > "Điểm tham khảo lâm sàng ở mức trung bình. Bạn có thể theo dõi định kỳ các chỉ số huyết áp, mỡ máu và trao đổi thêm với bác sĩ khi cần."
- **`CAO` / `RẤT CAO`:**
  > "Điểm tham khảo lâm sàng ở mức cao theo các chỉ số đã nhập. Đây là tín hiệu tham khảo để bạn cân nhắc trao đổi sớm với bác sĩ và xem xét thói quen sinh hoạt phù hợp."

---

## 3. Câu miễn trừ dùng chung (Disclaimer Banner)
Hiển thị cố định ở **Trang chủ, Trang đánh giá, Khung kết quả, Bản in PDF và Đầu khung Chatbot**:

- **Tiếng Việt:**
  > "Công cụ nghiên cứu tham khảo — không thay thế bác sĩ, không dùng để thay đổi thuốc điều trị. Nếu có triệu chứng cấp tính (đau ngực, khó thở, ngất), hãy gọi 115."
- **Tiếng Anh:**
  > "Research reference tool only — does not replace a physician or guide medication changes. For urgent symptoms (chest pain, shortness of breath, fainting), call emergency services."

---

## 4. Câu trả lời cố định cho Guardrail Chatbot (khi chặn cứng thuốc/liều/cấp cứu)
- **Chặn thuốc / liều lượng / tự điều trị:**
  > "Xin lỗi, hệ thống nghiên cứu này không được phép tư vấn về thuốc, thay đổi liều lượng hay hướng dẫn tự điều trị. Bạn vui lòng giữ nguyên chỉ định hiện tại và trao đổi trực tiếp với bác sĩ điều trị hoặc dược sĩ có chuyên môn."
- **Chặn tình huống triệu chứng cấp cứu:**
  > "Các triệu chứng như đau thắt ngực, khó thở dữ dội, choáng váng hoặc ngất cần được kiểm tra y tế khẩn cấp. Hệ thống AI không thể xử trí cấp cứu — bạn vui lòng gọi ngay 115 hoặc đến cơ sở y tế gần nhất."

---

## 5. Checklist kiểm tra trước khi chuyển sang Giai đoạn B
- [ ] Đọc lướt 5 tài liệu trong `docs/legal/` để kiểm tra tên, trường, email `tuannguyen2205@gmail.com`.
- [ ] Nhờ 1–2 người bạn đọc thử **Tóm tắt 5 dòng** và **4 câu `AI_MESSAGES`** xem có dễ hiểu và không gây hiểu nhầm thành bác sĩ phán bệnh hay không.
