# ❤️ HeartGuard AI — Hệ thống Dự đoán Nguy cơ Bệnh Tim mạch

Ứng dụng web ứng dụng Học máy (Machine Learning) để dự đoán nguy cơ mắc bệnh tim mạch dựa trên các chỉ số lâm sàng của người dùng, kèm chatbot AI tư vấn sức khỏe và hệ thống lưu trữ lịch sử chẩn đoán cá nhân.

## 📌 Tính năng chính

- **Dự đoán nguy cơ tim mạch**: Nhập các chỉ số lâm sàng (huyết áp, cholesterol, nhịp tim, ...) để nhận kết quả dự đoán và mức độ rủi ro từ mô hình Random Forest.
- **Chatbot AI tư vấn**: Trả lời các câu hỏi sức khỏe liên quan đến tim mạch, tích hợp Groq Cloud (model cấu hình qua `GROQ_MODEL`).
- **Quản lý tài khoản**: Đăng ký / đăng nhập / xác thực bằng JWT, quản lý hồ sơ cá nhân.
- **Lịch sử chẩn đoán**: Lưu và tra cứu lại các lần dự đoán trước đó.
- **Gói Premium**: Giới hạn số lượt chat AI theo hạng tài khoản (free / premium), thanh toán qua QR.
- **Đa ngôn ngữ (i18n)**: Hỗ trợ giao diện đa ngôn ngữ.

## 🏗️ Kiến trúc & Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend / API | FastAPI (Python), Uvicorn |
| Machine Learning | scikit-learn (Random Forest), joblib |
| Cơ sở dữ liệu | MySQL |
| Xác thực | JWT (jose / PyJWT), bcrypt |
| Chatbot AI | Groq Cloud API (`openai/gpt-oss-20b` mặc định) |
| Triển khai | Vercel (frontend), Render/Docker (backend) |

## 📂 Cấu trúc thư mục

```
heart-predict/
├── app/                    # Next.js App Router — các trang giao diện
│   ├── diagnosis/          # Trang chẩn đoán
│   ├── history/            # Lịch sử dự đoán
│   ├── login/, register/   # Xác thực
│   ├── predictions/        # Kết quả dự đoán
│   └── profile/            # Hồ sơ người dùng
├── components/             # React components (auth, chatbot, prediction, ui, ...)
├── lib/                    # Tiện ích frontend (db, auth, api-config, i18n)
├── api/                    # Backend FastAPI
│   ├── app/
│   │   ├── routers/        # Các API route (users, predictions, chatbot)
│   │   ├── auth.py         # Xác thực JWT
│   │   ├── config.py       # Cấu hình qua biến môi trường
│   │   ├── database.py     # Kết nối MySQL
│   │   ├── ml.py           # Xử lý inference mô hình ML
│   │   └── schemas.py      # Pydantic schemas
│   ├── main.py             # Entry point FastAPI
│   └── Dockerfile
├── models/                  # Model đã huấn luyện (.pkl)
├── notebook/                 # Notebook xử lý dữ liệu & huấn luyện mô hình
├── data/                     # Dữ liệu thô & đã xử lý
├── visualize/                 # Biểu đồ phân tích dữ liệu (EDA)
├── mindmap/                   # Sơ đồ tư duy thiết kế hệ thống
```

## ⚙️ Cài đặt & Chạy dự án

### 1. Yêu cầu
- Node.js ≥ 18
- Python ≥ 3.11 (model dùng scikit-learn 1.8.0; môi trường local hiện tại là Python 3.13)
- MySQL Server

### 2. Frontend (Next.js)

```bash
npm install
cp .env.example .env.local   # điền thông tin MySQL, JWT_SECRET, ...
npm run dev
```

Frontend chạy tại `http://localhost:3000`.

### 3. Backend (FastAPI)

```bash
cd api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env          # điền DB_*, JWT_SECRET_KEY, GROQ_API_KEY, MODEL_DIR
uvicorn main:app --reload --port 8000
```

Backend chạy tại `http://localhost:8000`, tài liệu API tự sinh tại `http://localhost:8000/docs`.

### 4. Biến môi trường cần thiết

Xem chi tiết trong [`.env.example`](./.env.example). Các biến quan trọng:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — kết nối MySQL
- `JWT_SECRET_KEY` — khóa ký JWT (bắt buộc set, không dùng giá trị mặc định)
- `GROQ_API_KEY` — API key cho chatbot AI
- `MODEL_DIR` — đường dẫn tới thư mục chứa model `.pkl`

## Nâng cấp hiệu năng và notebook EDA

Giao diện mới, tính năng đã triển khai và hướng phát triển: [GIAO_DIEN_VA_TINH_NANG_MOI.md](docs/GIAO_DIEN_VA_TINH_NANG_MOI.md).

Xem [hướng dẫn hiệu năng](docs/PERFORMANCE.md) để áp dụng index, cấu hình pool/CDN và chạy load test.
Notebook mới: [heart_disease_eda.ipynb](notebook/heart_disease_eda.ipynb).
Trong môi trường `.venv` của dự án, chạy `python scripts/run_eda.py` để xuất thống kê, biểu đồ và bản notebook đã thực thi vào `notebook/eda_outputs/`.

## 🧠 Mô hình Machine Learning

- Thuật toán: **Random Forest Classifier**
- Dữ liệu: bộ dữ liệu bệnh tim (Cleveland, Hungary, Switzerland, VA Long Beach)
- Pipeline tiền xử lý & huấn luyện: xem `notebook/last_process.ipynb` và `notebook/model trainning.ipynb`
- Các biểu đồ phân tích dữ liệu (EDA): thư mục `visualize/`
- Artifacts đã huấn luyện: `models/random_forest_model.pkl`, `models/heart_scaler.pkl`, `models/feature_names.pkl`

## 👤 Tác giả

Nguyễn Minh Tuấn — Sinh viên Khoa học Dữ liệu, Đại học Giao Thông Vận Tải TP.HCM

## 📄 Giấy phép

Dự án phục vụ mục đích học tập / demo. Vui lòng liên hệ tác giả trước khi sử dụng cho mục đích thương mại.
