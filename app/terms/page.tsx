"use client";

import Link from "next/link";
import { Header } from "@/components/header";
import { MedicalDisclaimer } from "@/components/ui/medical-disclaimer";
import { CURRENT_TERMS_VERSION } from "@/lib/api-config";
import { ArrowLeft, FileText, ShieldCheck, Cpu, Mail } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="app-shell">
      <Header user={null} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại trang đăng ký
          </Link>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            Phiên bản: {CURRENT_TERMS_VERSION} • Hiệu lực: 20/11/2026
          </span>
        </div>

        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Điều khoản sử dụng, Quyền riêng tư &amp; Phương pháp nghiên cứu
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            HeartGuard là nguyên mẫu nghiên cứu khoa học dữ liệu cá nhân, <strong>100% phi thương mại</strong>,
            thực hiện bởi <strong>Nguyễn Minh Tuấn</strong> (Sinh viên, UTH – University of Transport).
          </p>
          <MedicalDisclaimer language="vi" />
        </div>

        {/* Điều hướng nhanh theo mục */}
        <nav
          aria-label="Mục lục pháp lý"
          className="mb-8 flex flex-wrap gap-2 border-y border-slate-200 py-3 text-xs font-semibold"
        >
          <a href="#terms" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700">
            1. Điều khoản sử dụng
          </a>
          <a href="#privacy" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700">
            2. Chính sách dữ liệu &amp; Quyền riêng tư
          </a>
          <a href="#method" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700">
            3. Phương pháp &amp; Hạn chế mô hình
          </a>
          <a href="#contact" className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700">
            4. Liên hệ &amp; Quyền xóa dữ liệu
          </a>
        </nav>

        <div className="space-y-8 text-sm leading-7 text-slate-700">
          {/* 1. Điều khoản sử dụng */}
          <section id="terms" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-sky-600" />
              1. Điều khoản sử dụng &amp; Miễn trừ trách nhiệm y tế
            </h2>
            <ul className="list-disc space-y-2.5 pl-5">
              <li>
                <strong>Bản chất hệ thống:</strong> HeartGuard là nguyên mẫu nghiên cứu kỹ thuật kết hợp mô hình Học máy
                và Trợ lý AI nhằm đánh giá trải nghiệm người dùng. Hệ thống <strong>không phải thiết bị y tế</strong>,
                không được cấp phép chẩn đoán hay điều trị, và không đại diện cho bệnh viện hay phòng khám.
              </li>
              <li>
                <strong>Không thay thế bác sĩ:</strong> Mọi kết quả ước lượng nguy cơ, điểm tham khảo, chỉ số BMI, bản in
                PDF và câu trả lời của Trợ lý AI chỉ mang tính chất tham khảo.
              </li>
              <li>
                <strong>Không tự ý điều chỉnh thuốc:</strong> Người dùng tuyệt đối không tự ý ngừng thuốc, tăng/giảm liều
                hoặc trì hoãn đi khám dựa trên kết quả từ hệ thống. Nếu có triệu chứng cấp tính (đau thắt ngực, khó thở,
                choáng váng, ngất), hãy <strong>gọi cấp cứu 115</strong> hoặc đến cơ sở y tế gần nhất.
              </li>
              <li>
                <strong>Điều kiện tham gia:</strong> Tự nguyện, từ <strong>đủ 18 tuổi trở lên</strong>. Khuyến khích trải
                nghiệm bằng dữ liệu giả lập (ca mẫu). Không phù hợp cho người đang cần tư vấn điều trị bệnh tim mạch cấp tính.
              </li>
              <li>
                <strong>Phi thương mại:</strong> Toàn bộ hệ thống trong đợt thử nghiệm là miễn phí và không cung cấp tính
                năng thu phí.
              </li>
            </ul>
          </section>

          {/* 2. Chính sách bảo vệ dữ liệu */}
          <section id="privacy" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
              2. Chính sách bảo vệ dữ liệu &amp; Quyền riêng tư
            </h2>
            <ul className="list-disc space-y-2.5 pl-5">
              <li>
                <strong>Nguyên tắc tối thiểu hóa:</strong> Dữ liệu sức khỏe là dữ liệu cá nhân nhạy cảm. Bạn được khuyến
                khích sử dụng tên đăng nhập ẩn danh (nickname) và không nhập họ tên thật, số CCCD, địa chỉ hay mã hồ sơ
                bệnh án vào hệ thống hoặc khung trò chuyện AI.
              </li>
              <li>
                <strong>Dữ liệu được lưu trữ:</strong> Thông tin tài khoản (mật khẩu được băm bảo mật bằng bcrypt), bằng
                chứng đồng ý điều khoản (phiên bản và thời điểm xác nhận), các chỉ số đánh giá bạn lưu vào lịch sử và lịch
                sử trò chuyện AI.
              </li>
              <li>
                <strong>Xử lý bởi bên thứ ba (Groq Cloud API):</strong> Khi sử dụng Trợ lý giải đáp thông tin, nội dung tin
                nhắn (cùng ngữ cảnh hội thoại gần nhất và kết quả ước lượng gần nhất, nếu có) được gửi qua kết nối mã hóa
                HTTPS tới máy chủ AI bên thứ ba (Groq) để sinh phản hồi. Mật khẩu, email và số điện thoại không được gửi
                tới Groq.
              </li>
              <li>
                <strong>Mục đích &amp; Thời hạn lưu trữ:</strong> Dữ liệu chỉ dùng cho vận hành thử nghiệm và thống kê ẩn
                danh phục vụ cải thiện sản phẩm, không bán hay chia sẻ thương mại. Sau khi kết thúc đợt thử nghiệm (tối đa
                14 ngày), toàn bộ thông tin định danh tài khoản và dữ liệu sức khỏe cá nhân sẽ được xóa khỏi hệ thống.
              </li>
            </ul>
          </section>

          {/* 3. Phương pháp & Hạn chế mô hình */}
          <section id="method" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <Cpu className="h-5 w-5 text-sky-600" />
              3. Phương pháp &amp; Hạn chế của mô hình
            </h2>
            <ul className="list-disc space-y-2.5 pl-5">
              <li>
                <strong>Dữ liệu huấn luyện:</strong> Mô hình Học máy (Random Forest) được huấn luyện trên tập dữ liệu nghiên
                cứu công khai <strong>UCI Heart Disease</strong> (920 bản ghi từ 4 trung tâm tại Mỹ và Châu Âu).
              </li>
              <li>
                <strong>Lệch phân bố dân số (Domain Shift):</strong> Do sự khác biệt về dân số, lối sống và thời điểm thu
                thập dữ liệu so với người Việt Nam hiện đại, kết quả ước lượng có thể sai lệch.
              </li>
              <li>
                <strong>Khả năng sai số:</strong> Mức ước lượng <em>thấp</em> không loại trừ bệnh lý tiềm ẩn; mức ước lượng{" "}
                <em>cao/rất cao</em> không phải kết luận mắc bệnh. Hệ thống chưa trải qua kiểm định lâm sàng tại bệnh viện.
              </li>
            </ul>
          </section>

          {/* 4. Liên hệ & Quyền xóa dữ liệu */}
          <section id="contact" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <Mail className="h-5 w-5 text-sky-600" />
              4. Liên hệ &amp; Quyền xóa dữ liệu
            </h2>
            <p className="mb-3">
              Bạn có thể gửi <strong>yêu cầu xóa tài khoản kèm lý do</strong> ngay tại trang{" "}
              <Link href="/profile" className="font-semibold text-sky-700 hover:underline">
                Hồ sơ cá nhân
              </Link>{" "}
              hoặc gửi yêu cầu trực tiếp qua email. Quản trị viên sẽ rà soát và <strong>cam kết xóa hoàn toàn dữ liệu trong vòng 24 giờ</strong> nếu không có vấn đề phát sinh:
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700">
              <p><strong>Người thực hiện:</strong> Nguyễn Minh Tuấn — Sinh viên, UTH (University of Transport)</p>
              <p><strong>Email liên hệ &amp; yêu cầu xóa dữ liệu:</strong>{" "}
                <a href="mailto:tuannguyen2205@gmail.com" className="font-semibold text-sky-700 hover:underline">
                  tuannguyen2205@gmail.com
                </a>
              </p>
              <p><strong>Cam kết xử lý yêu cầu xóa:</strong> Duyệt và xóa toàn bộ dữ liệu trong vòng <strong>24 giờ</strong> nếu không có sự cố phát sinh.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
