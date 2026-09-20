"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { getAccessToken } from "@/lib/client-session";
import { useLanguage } from "@/lib/i18n/context";
import { ArrowRight, ClipboardList, History, UserRound, FileCheck2, HeartPulse, ChevronRight } from "lucide-react";

export default function HomePage() {
  const { language } = useLanguage();
  const vi = language === "vi";
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => { if (getAccessToken()) setUsername(localStorage.getItem("username")); }, []);
  const destination = (path: string) => username ? path : "/login";
  const services = [
    { href: "/diagnosis", icon: ClipboardList, title: vi ? "Đánh giá nguy cơ" : "Risk assessment", text: vi ? "Nhập chỉ số, xem kết quả và lưu lại từng lần đánh giá." : "Enter indicators, review results and save your assessment.", action: vi ? "Bắt đầu đánh giá" : "Start assessment" },
    { href: "/history", icon: History, title: vi ? "Lịch sử đánh giá" : "Assessment history", text: vi ? "Tra cứu các kết quả đã lưu theo tên hoặc mức nguy cơ." : "Find saved results by name or risk level.", action: vi ? "Tra cứu lịch sử" : "View history" },
    { href: "/profile", icon: UserRound, title: vi ? "Hồ sơ sức khỏe" : "Health profile", text: vi ? "Cập nhật thông tin cơ bản để sử dụng cho lần đánh giá tiếp theo." : "Keep basic information ready for your next assessment.", action: vi ? "Xem hồ sơ" : "View profile" },
  ];
  const preparation = vi ? ["Tuổi, giới tính; chiều cao và cân nặng nếu có", "Huyết áp lúc nghỉ và kết quả cholesterol", "Thông tin điện tâm đồ, nghiệm pháp gắng sức"] : ["Age, sex; optional height and weight", "Resting blood pressure and cholesterol results", "ECG and exercise test information"];
  const questions = vi ? [
    ["Tôi cần chuẩn bị gì trước khi đánh giá?", "Chuẩn bị các chỉ số từ hồ sơ hoặc phiếu xét nghiệm của bạn. Biểu mẫu ghi rõ đơn vị cho từng trường. Với chỉ số chưa biết, hãy kiểm tra lại phiếu kết quả trước khi nhập."],
    ["Kết quả có tự lưu vào lịch sử không?", "Sau khi xem kết quả, chọn “Lưu vào lịch sử”. Bạn cũng có thể chọn “In / lưu PDF” để lưu phiếu gồm kết quả và các thông tin đã nhập trên thiết bị."],
    ["Tôi có thể sử dụng thông tin trong hồ sơ không?", "Có. Ở bước đầu của biểu mẫu, chọn “Lấy thông tin từ hồ sơ”. Hệ thống điền các ô còn trống; bạn cần kiểm tra lại chỉ số trước khi thực hiện đánh giá."],
  ] : [
    ["What should I prepare?", "Have your measurements and test reports ready. Check the unit shown for each field, and refer to your report when a value is unknown."],
    ["Are results saved automatically?", "Choose “Save to history” after reviewing the result. Use “Print / save PDF” to keep the assessment and submitted inputs on your device."],
    ["Can I reuse my profile information?", "Yes. Choose “Use profile information” in the first step to fill empty fields. Review the values before submitting a new assessment."],
  ];
  return <div className="app-shell">
    <Header user={username ? { id: 0, email: "", full_name: username } : null} />
    <main id="main-content">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:gap-20 lg:px-8">
          <div className="self-center">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-teal-700"><HeartPulse className="h-5 w-5" />{vi ? "CHĂM SÓC SỨC KHỎE TIM MẠCH" : "CARDIOVASCULAR HEALTH"}</p>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[42px] sm:leading-[1.2]">{vi ? <>Chủ động theo dõi.<br /><span className="text-primary">Hiểu rõ sức khỏe của bạn.</span></> : <>Stay informed.<br /><span className="text-primary">Understand your heart health.</span></>}</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">{vi ? "Không gian quản lý thông tin sức khỏe, đánh giá nguy cơ tim mạch và tra cứu kết quả của bạn." : "Your space to manage health information, assess cardiovascular risk and review past results."}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link className="action-link" href={destination("/diagnosis")}>{vi ? "Đánh giá nguy cơ" : "Assess risk"}<ArrowRight className="h-4 w-4" /></Link>
              <a href="#huong-dan" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">{vi ? "Hướng dẫn sử dụng" : "How it works"}</a>
            </div>
            {username && <p className="mt-5 text-sm text-slate-500">{vi ? "Xin chào," : "Welcome,"} <span className="font-medium text-slate-700">{username}</span></p>}
          </div>
          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-[#edf5fa] px-6 py-5"><FileCheck2 className="h-6 w-6 text-primary" /><div><h2 className="font-semibold text-slate-900">{vi ? "Chuẩn bị trước khi bắt đầu" : "Before you begin"}</h2><p className="mt-1 text-sm text-slate-600">{vi ? "Sử dụng thông tin từ phiếu khám của bạn" : "Have your health records ready"}</p></div></div>
            <ol className="divide-y divide-slate-200 px-6">{preparation.map((item, i) => <li key={item} className="flex items-start gap-4 py-5 text-sm leading-6 text-slate-700"><span className="shrink-0 font-semibold tabular-nums text-teal-700">0{i + 1}</span>{item}</li>)}</ol>
            <p className="px-6 pb-5 text-xs leading-5 text-slate-500">{vi ? "Kết quả mang tính tham khảo, không thay thế chẩn đoán của bác sĩ." : "Results are for reference and do not replace a medical diagnosis."}</p>
          </aside>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="services-title">
        <h2 id="services-title" className="text-2xl font-semibold text-slate-900">{vi ? "Tiện ích sức khỏe" : "Health services"}</h2>
        <p className="mb-6 mt-2 text-sm text-slate-600">{vi ? "Thông tin và kết quả được quản lý theo tài khoản của bạn." : "Your information and results, organised by account."}</p>
        <div className="grid gap-5 md:grid-cols-3">{services.map(({ href, icon: Icon, title, text, action }) => <article key={href} className="flex flex-col rounded-lg border border-slate-200 bg-white p-6"><Icon className="mb-5 h-7 w-7 text-teal-700" strokeWidth={1.6} /><h3 className="text-lg font-semibold">{title}</h3><p className="mb-6 mt-2 text-sm leading-6 text-slate-600">{text}</p><Link href={destination(href)} className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-primary hover:underline">{action}<ChevronRight className="h-4 w-4" /></Link></article>)}</div>
      </section>
      <section id="huong-dan" className="scroll-mt-24 border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[.7fr_1.3fr] lg:gap-16 lg:px-8"><div><p className="mb-2 text-sm font-semibold text-teal-700">{vi ? "HƯỚNG DẪN" : "GETTING STARTED"}</p><h2 className="text-2xl font-semibold">{vi ? "Sử dụng HeartGuard" : "Using HeartGuard"}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{vi ? "Những thông tin cần biết để hoàn thành và lưu lại một lần đánh giá." : "What to know before completing and saving an assessment."}</p></div><div className="divide-y divide-slate-200">{questions.map(([q, a], i) => <details key={q} className="group py-4 first:pt-0" open={i === 0}><summary className="cursor-pointer text-sm font-semibold leading-6 text-slate-800 marker:text-primary">{q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{a}</p></details>)}</div></div>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 py-6 text-xs leading-5 text-slate-500 sm:flex-row sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} HeartGuard</p><p>{vi ? "Thông tin sức khỏe • Đánh giá nguy cơ • Theo dõi kết quả" : "Health information • Risk assessment • Assessment history"}</p></footer>
  </div>;
}
