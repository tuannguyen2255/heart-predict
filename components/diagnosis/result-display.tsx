"use client";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, RefreshCcw, Info } from "lucide-react";
import { AssessmentResult } from "@/lib/assessment";

export function ResultDisplay({ result, onReset }: { result: AssessmentResult | null; onReset: () => void }) {
  const { language } = useLanguage();
  const vi = language === "vi";
  const riskStyle = (level: string) => {
    if (["THẤP", "THAP", "LOW"].includes(level)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (["TRUNG BÌNH", "TRUNG BINH", "MEDIUM"].includes(level)) return "border-amber-200 bg-amber-50 text-amber-800";
    if (["CAO", "HIGH"].includes(level)) return "border-orange-200 bg-orange-50 text-orange-800";
    if (["RẤT CAO", "RAT CAO", "VERY HIGH"].includes(level)) return "border-red-200 bg-red-50 text-red-800";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };
  return <Card className="overflow-hidden" aria-live="polite">
    <CardHeader className="border-b border-slate-200 bg-slate-50">
      <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />{vi ? "Kết quả đánh giá" : "Assessment result"}</CardTitle>
    </CardHeader>
    {!result ? <CardContent className="space-y-5 pt-6">
      <p className="text-sm leading-6 text-slate-600">{vi ? "Kết quả sẽ xuất hiện tại đây sau khi bạn hoàn tất và gửi biểu mẫu." : "Your result will appear here after you complete and submit the form."}</p>
      <ol className="space-y-4 text-sm text-slate-600">{(vi ? ["Điền thông tin cơ bản", "Nhập chỉ số từ phiếu khám", "Kiểm tra thông tin và đánh giá"] : ["Enter basic information", "Add measurements from your records", "Review and submit"]).map((text, i) => <li className="flex items-center gap-3" key={text}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs text-primary">{i + 1}</span>{text}</li>)}</ol>
      <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{vi ? "Các ô có dấu * là bắt buộc. Chiều cao và cân nặng có thể để trống cả hai." : "Fields marked * are required. Height and weight may both be left empty."}</p>
    </CardContent> : <CardContent className="space-y-5 pt-6">
      <div className={`rounded-md border px-4 py-3 ${riskStyle(result.ai_prediction.risk_level)}`}><p className="text-xs">{vi ? "Mức nguy cơ do hệ thống trả về" : "Risk level returned by the system"}</p><p className="mt-1 text-xl font-semibold">{result.ai_prediction.risk_level}</p></div>
      <dl className="divide-y divide-slate-100 text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-slate-600">{vi ? "Giá trị mô hình trả về" : "Model output"}</dt><dd className="font-semibold tabular-nums">{(result.ai_prediction.probability * 100).toFixed(1)}%</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-slate-600">{vi ? "Điểm lâm sàng" : "Clinical score"}</dt><dd className="font-semibold tabular-nums">{(result.clinical_evaluation.probability * 10).toFixed(1)} / 10</dd></div>
        <div className="flex justify-between gap-4 py-3"><dt className="text-slate-600">BMI</dt><dd className="font-semibold tabular-nums">{result.bmi?.toFixed(1) ?? (vi ? "Chưa có dữ liệu" : "Not provided")}</dd></div>
      </dl>
      <div><h3 className="mb-2 text-sm font-semibold">{vi ? "Nhận xét từ hệ thống" : "System feedback"}</h3><p className="text-sm leading-6 text-slate-600">{result.ai_prediction.message}</p></div>
      <div className="flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>{vi ? "Kết quả mang tính tham khảo, không thay thế chẩn đoán của bác sĩ." : "For reference only. This does not replace a medical diagnosis."}</p></div>
      <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2" onClick={onReset}><RefreshCcw className="h-4 w-4 shrink-0" />{vi ? "Tạo lần đánh giá mới" : "Start a new assessment"}</Button>
    </CardContent>}
  </Card>;
}
