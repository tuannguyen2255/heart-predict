"use client";

import { getAccessToken } from "@/lib/client-session";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { MultiStepDiagnosisForm } from "@/components/diagnosis/multi-step-form";
import { useLanguage } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";

export default function DiagnosisPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername || !getAccessToken()) {
      router.push("/login");
    } else {
      setUsername(storedUsername);
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header user={username ? { id: 0, email: "", full_name: username } : null} />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7">
          <div>
            <p className="mb-2 text-sm text-slate-500">HeartGuard / {language === "vi" ? "Đánh giá nguy cơ" : "Assessment"}</p>
            <h1 className="page-heading">{language === "vi" ? "Đánh giá nguy cơ tim mạch" : "Cardiovascular risk assessment"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{language === "vi" ? "Nhập thông tin từ phiếu khám hoặc kết quả xét nghiệm. Kiểm tra đơn vị và giá trị trước khi gửi." : "Use your health records or test results. Check each value and unit before submitting."}</p>
          </div>
        </div>
        <MultiStepDiagnosisForm />
      </main>
    </div>
  );
}
