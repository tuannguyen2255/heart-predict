# Phương pháp & Tuyên bố Hạn chế của Mô hình (Model Limitations)

- **Phiên bản:** `beta-v1.0`
- **Người thực hiện:** Nguyễn Minh Tuấn (Sinh viên, UTH – University of Transport)

---

## 1. Nguồn dữ liệu huấn luyện
Mô hình học máy trong HeartGuard được huấn luyện trên tập dữ liệu nghiên cứu công khai **UCI Heart Disease** (tổng hợp 920 bản ghi lâm sàng từ 4 trung tâm tại Mỹ và Châu Âu: Cleveland, Hungary, Switzerland, VA Long Beach), với 14 thuộc tính gốc và 22 đặc trưng sau bước tiền xử lý.

## 2. Cách hệ thống tính kết quả tham khảo
Hệ thống hiển thị song song hai góc nhìn tham khảo:
1. **Ước lượng từ mô hình Học máy (Random Forest):** Tính xác suất thống kê dựa trên mẫu hình học được từ tập dữ liệu UCI.
2. **Thang điểm tham khảo lâm sàng (Clinical Score) & BMI:** Tính theo các quy tắc ngưỡng chỉ số cơ bản để đối chiếu thêm.

## 3. Các hạn chế quan trọng người dùng cần biết
1. **Lệch phân bố dân số (Domain / Population Shift):** Tập dữ liệu UCI được thu thập từ nhiều thập kỷ trước trên dân số phương Tây. Do sự khác biệt về di truyền, lối sống, tiêu chuẩn xét nghiệm và đặc điểm dân số Việt Nam hiện đại, kết quả ước lượng **có thể sai lệch** khi áp dụng ngoài tập dữ liệu gốc.
2. **Cỡ mẫu còn hạn chế:** 920 bản ghi là quy mô phù hợp cho nghiên cứu học thuật, chưa đủ lớn để thay thế đánh giá y khoa thực tế.
3. **Không đánh giá toàn diện lâm sàng:** Mô hình chỉ dựa trên các con số người dùng nhập tay; không có hình ảnh siêu âm tim, xét nghiệm chuyên sâu, tiền sử dùng thuốc hay thăm khám trực tiếp của bác sĩ.
4. **Rủi ro âm tính giả / dương tính giả:**
   - Mức ước lượng **THẤP** *không đảm bảo* bạn không có vấn đề tim mạch tiềm ẩn.
   - Mức ước lượng **CAO / RẤT CAO** *không phải là kết luận mắc bệnh*; đây chỉ là gợi ý để bạn cân nhắc trao đổi với bác sĩ chuyên khoa.
5. **Chưa kiểm định lâm sàng tại bệnh viện:** Hệ thống chưa trải qua kiểm định ngoài (External Validation) trên dữ liệu bệnh viện tại Việt Nam và chưa đăng ký thiết bị y tế (SaMD).

## 4. Khuyến nghị sử dụng đúng mục đích
Hãy xem HeartGuard như một **công cụ minh họa kỹ thuật và tham khảo thông tin ban đầu**. Đối với mọi quyết định liên quan đến sức khỏe, xét nghiệm hoặc thuốc điều trị, hãy tham khảo trực tiếp ý kiến của bác sĩ có chuyên môn.
