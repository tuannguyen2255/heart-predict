"use client";
import { ReactNode } from "react";
import { ClipboardList, History, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export function AuthShell({ children, mode }: { children: ReactNode; mode: "login" | "register" }) {
  const { language } = useLanguage();
  const vi = language === "vi";
  return <main id="main-content" className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-16">
    <section className="hidden lg:block">
      <p className="mb-4 text-sm font-semibold text-teal-700">HEARTGUARD</p>
      <h1 className="text-3xl font-semibold leading-tight text-slate-900">{mode === "login" ? (vi ? "Tiếp tục theo dõi sức khỏe của bạn" : "Continue your health tracking") : (vi ? "Một tài khoản cho thông tin sức khỏe của bạn" : "One account for your health information")}</h1>
      <p className="mt-4 leading-7 text-slate-600">{vi ? "Quản lý hồ sơ và lưu lại các lần đánh giá tim mạch trong cùng một nơi." : "Manage your profile and keep your cardiovascular assessments in one place."}</p>
      <ul className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{[{ icon: UserRound, text: vi ? "Cập nhật hồ sơ sức khỏe" : "Update your health profile" }, { icon: ClipboardList, text: vi ? "Thực hiện đánh giá nguy cơ" : "Complete a risk assessment" }, { icon: History, text: vi ? "Tra cứu các kết quả đã lưu" : "Review saved assessments" }].map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-4 py-5 text-sm text-slate-700"><Icon className="h-5 w-5 text-teal-700" />{text}</li>)}</ul>
    </section>
    <section className="mx-auto w-full max-w-md">{children}</section>
  </main>;
}
