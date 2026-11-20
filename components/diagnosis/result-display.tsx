"use client";

import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, RefreshCcw, Info, Activity, Gauge, HeartPulse, Users } from "lucide-react";
import { AssessmentResult } from "@/lib/assessment";
import { MedicalDisclaimer } from "@/components/ui/medical-disclaimer";


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

  const getRiskColor = (percent: number) => {
    if (percent <= 30) return "bg-emerald-500";
    if (percent <= 60) return "bg-amber-500";
    if (percent <= 80) return "bg-orange-500";
    return "bg-rose-500";
  };

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: vi ? "Gầy" : "Underweight", color: "text-amber-600" };
    if (bmi < 23) return { label: vi ? "Bình thường" : "Normal", color: "text-emerald-600" };
    if (bmi < 25) return { label: vi ? "Tiền béo phì" : "Overweight", color: "text-amber-600" };
    return { label: vi ? "Béo phì" : "Obese", color: "text-rose-600" };
  };

  // Mốc tham chiếu từ dữ liệu UCI (n = 918): 44.7% khỏe (0), 55.3% có nguy cơ (1)
  const POPULATION_HEALTHY_PCT = 44.7;
  const userHealthyPct = result ? Math.max(0, Math.min(100, (1 - result.ai_prediction.probability) * 100)) : 0;
  const healthyDiff = userHealthyPct - POPULATION_HEALTHY_PCT;

  return (
    <Card className="overflow-hidden shadow-sm" aria-live="polite">
      <CardHeader className="border-b border-slate-200 bg-slate-50 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <ClipboardList className="h-5 w-5 text-primary" />
          {vi ? "Kết quả đánh giá" : "Assessment result"}
        </CardTitle>
      </CardHeader>

      {!result ? (
        <CardContent className="space-y-5 pt-6">
          <p className="text-sm leading-6 text-slate-600">
            {vi ? "Kết quả sẽ xuất hiện tại đây sau khi bạn hoàn tất và gửi biểu mẫu." : "Your result will appear here after you complete and submit the form."}
          </p>
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {vi ? "Quy trình phân tích" : "Workflow"}
            </p>
            <ol className="space-y-2.5 text-xs text-slate-600">
              {[
                vi ? "Nhập thông tin cơ bản & các chỉ số" : "Enter basic & clinical measurements",
                vi ? "Hệ thống tiền xử lý và chạy mô hình AI" : "Pipeline pre-processing & AI evaluation",
                vi ? "Xem biểu đồ trực quan & lưu lịch sử" : "View visual charts & save to history",
              ].map((text, i) => (
                <li className="flex items-center gap-2.5" key={text}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-primary">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </div>
          <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {vi ? "Các ô có dấu * là bắt buộc. Chiều cao và cân nặng có thể để trống cả hai." : "Fields marked * are required. Height and weight may both be left empty."}
          </p>
        </CardContent>
      ) : (
        <CardContent className="space-y-5 pt-6">
          {/* Badge mức nguy cơ */}
          <div className={`rounded-lg border px-4 py-3.5 ${riskStyle(result.ai_prediction.risk_level)}`}>
            <p className="text-xs font-medium uppercase tracking-wider opacity-90">
              {vi ? "Mức độ nguy cơ tổng thể" : "Overall Risk Level"}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{result.ai_prediction.risk_level}</p>
          </div>

          {/* Dashboard mini: Đối chiếu với tập dữ liệu nghiên cứu UCI */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Users className="h-4 w-4 text-sky-600" />
                {vi ? "Đối chiếu tập nghiên cứu UCI" : "Comparison vs. UCI Cohort"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  healthyDiff >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {healthyDiff >= 0 ? `+${healthyDiff.toFixed(1)}%` : `${healthyDiff.toFixed(1)}%`}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="font-medium text-slate-700">{vi ? "Điểm tham khảo mô phỏng" : "Estimated reference score"}</span>
                  <span className="font-bold tabular-nums text-emerald-700">{userHealthyPct.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.max(4, userHealthyPct)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-slate-500">{vi ? "Nhóm không ghi nhận bệnh (UCI, n=918)" : "Non-disease share in UCI (n=918)"}</span>
                  <span className="font-semibold tabular-nums text-slate-600">{POPULATION_HEALTHY_PCT}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${POPULATION_HEALTHY_PCT}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-4 text-slate-500">
              {healthyDiff >= 0
                ? vi
                  ? `Điểm tham khảo mô phỏng cao hơn ${healthyDiff.toFixed(1)} điểm % so với tỷ lệ không ghi nhận bệnh trong tập dữ liệu nghiên cứu UCI (không đại diện cho dân số chung).`
                  : `Estimated reference score is ${healthyDiff.toFixed(1)} pts above the UCI research cohort non-disease share (not representative of the general population).`
                : vi
                  ? `Điểm tham khảo mô phỏng thấp hơn ${Math.abs(healthyDiff).toFixed(1)} điểm % so với mức tham chiếu của tập nghiên cứu UCI — bạn có thể cân nhắc trao đổi thêm với bác sĩ.`
                  : `Estimated reference score is ${Math.abs(healthyDiff).toFixed(1)} pts below the UCI research reference — consider discussing with a physician.`}
            </p>
          </div>

          {/* 1. Biểu đồ Visual: Thanh đo mức ước lượng nguy cơ AI */}
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Gauge className="h-4 w-4 text-primary" />
                {vi ? "Mức ước lượng nguy cơ (AI)" : "Estimated AI Risk Score"}
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {(result.ai_prediction.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-700 ease-out ${getRiskColor(result.ai_prediction.probability * 100)}`}
                style={{ width: `${Math.min(100, Math.max(5, result.ai_prediction.probability * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0% ({vi ? "Mức thấp" : "Low"})</span>
              <span>50%</span>
              <span>100% ({vi ? "Rất cao" : "Very high"})</span>
            </div>
          </div>

          {/* 2. Biểu đồ Visual: Thang điểm lâm sàng */}
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <HeartPulse className="h-4 w-4 text-rose-500" />
                {vi ? "Điểm cảnh báo lâm sàng" : "Clinical Warning Score"}
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {(result.clinical_evaluation.probability * 10).toFixed(1)}{" "}
                <span className="text-xs font-normal text-slate-500">/ 10</span>
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const score = result.clinical_evaluation.probability * 10;
                const active = i < Math.round(score);
                return (
                  <div
                    key={i}
                    className={`h-2.5 rounded-sm transition-colors duration-500 ${
                      active
                        ? i < 3
                          ? "bg-emerald-400"
                          : i < 7
                          ? "bg-amber-400"
                          : "bg-rose-500"
                        : "bg-slate-200"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* 3. Phân tích chỉ số BMI */}
          {result.bmi ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Activity className="h-4 w-4 text-teal-600" />
                  {vi ? "Chỉ số thể trọng (BMI)" : "Body Mass Index (BMI)"}
                </span>
                <div className="text-right">
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {result.bmi.toFixed(1)}
                  </span>
                  <span className={`ml-2 text-xs font-semibold ${getBmiCategory(result.bmi).color}`}>
                    ({getBmiCategory(result.bmi).label})
                  </span>
                </div>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-teal-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(10, (result.bmi / 40) * 100))}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Nhận xét từ AI */}
          <div className="rounded-lg bg-sky-50/50 p-4 text-xs leading-5 text-slate-700 border border-sky-100">
            <h3 className="mb-1.5 font-semibold text-slate-900 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" />
              {vi ? "Nhận xét từ hệ thống:" : "System feedback:"}
            </h3>
            <p>{result.ai_prediction.message}</p>
          </div>

          <MedicalDisclaimer language={vi ? "vi" : "en"} compact />

          <Button variant="outline" className="h-10 w-full text-xs font-semibold" onClick={onReset}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            {vi ? "Tạo lần đánh giá mới" : "Start a new assessment"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
