"use client";

import { Info } from "lucide-react";

interface MedicalDisclaimerProps {
  language?: "vi" | "en";
  compact?: boolean;
  className?: string;
}

export function MedicalDisclaimer({
  language = "vi",
  compact = false,
  className = "",
}: MedicalDisclaimerProps) {
  const text =
    language === "vi"
      ? "Công cụ nghiên cứu tham khảo — không thay thế bác sĩ, không dùng để thay đổi thuốc điều trị. Nếu có triệu chứng cấp tính (đau ngực, khó thở, ngất), hãy gọi 115."
      : "Research reference tool only — does not replace a physician or guide medication changes. For urgent symptoms (chest pain, shortness of breath, fainting), call emergency services.";

  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 ${
        compact ? "px-3 py-2 text-[11px] leading-4" : "px-3.5 py-2.5 text-xs leading-5"
      } ${className}`}
    >
      <Info className={`shrink-0 text-sky-600 ${compact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4"}`} />
      <p>{text}</p>
    </div>
  );
}