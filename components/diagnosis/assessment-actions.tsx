"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Save, Printer, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/lib/api-config";
import { getAccessToken } from "@/lib/client-session";
import { apiErrorMessage } from "@/lib/api-errors";
import { invalidateHistory } from "@/lib/history";
import { AssessmentSnapshot, historyPayload } from "@/lib/assessment";
import { useLanguage } from "@/lib/i18n/context";

export function AssessmentActions({ snapshot }: { snapshot: AssessmentSnapshot }) {
  const { language } = useLanguage();
  const vi = language === "vi";
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setStatus("saving"); setError("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error(vi ? "Vui lòng đăng nhập lại để lưu kết quả." : "Sign in again to save the result.");
      const response = await fetch(API_ENDPOINTS.historyPredictions, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(historyPayload(snapshot)),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      setStatus("saved");
      void invalidateHistory().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu kết quả.");
      setStatus("idle"); lock.current = false;
    }
  }
  return <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
    <p className="mb-3 text-sm font-medium text-slate-800">{snapshot.inputs.name_prediction || (vi ? "Lần đánh giá hiện tại" : "Current assessment")}</p>
    <p className="mb-3 text-xs leading-5 text-slate-500">{vi ? "Sử dụng thông tin đã gửi lúc " : "Uses the information submitted at "}{new Date(snapshot.createdAt).toLocaleString(vi ? "vi-VN" : "en-GB")}.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={save} disabled={status !== "idle"}>{status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{status === "saved" ? (vi ? "Đã lưu kết quả" : "Saved") : status === "saving" ? (vi ? "Đang lưu..." : "Saving...") : (vi ? "Lưu vào lịch sử" : "Save to history")}</Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{vi ? "In / lưu PDF" : "Print / save PDF"}</Button>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500" role="status">{status === "saved" ? <Link href="/history" className="font-medium text-primary underline">{vi ? "Xem trong lịch sử đánh giá" : "View assessment history"}</Link> : (vi ? "Kết quả chỉ được lưu vào lịch sử khi bạn chọn lưu." : "Results are added to history only when you choose to save.")}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}

export function AssessmentPrint({ snapshot }: { snapshot: AssessmentSnapshot }) {
  const { language, t } = useLanguage();
  const vi = language === "vi";
  const input = snapshot.inputs;
  const yesNo = (value: string) => value === "1" ? (vi ? "Có" : "Yes") : (vi ? "Không" : "No");
  const rows = [
    [t("field.age"), input.age], [t("field.sex"), input.sex === "1" ? t("field.sex.male") : t("field.sex.female")],
    [vi ? "Chiều cao (cm)" : "Height (cm)", input.height || "—"], [vi ? "Cân nặng (kg)" : "Weight (kg)", input.weight || "—"],
    [t("field.trestbps"), input.trestbps], [t("field.chol"), input.chol], [t("field.thalch"), input.thalch], [t("field.oldpeak"), input.oldpeak],
    [t("field.fbs"), yesNo(input.fbs)], [t("field.exang"), yesNo(input.exang)],
    [t("field.cp"), t(({ typical_angina: "field.cp.typical", atypical_angina: "field.cp.atypical", non_anginal: "field.cp.nonAnginal", asymptomatic: "field.cp.asymptomatic" } as Record<string, string>)[input.cp])],
    [t("field.restecg"), t(({ normal: "field.restecg.normal", st_t_abnormality: "field.restecg.sttwave", lv_hypertrophy: "field.restecg.lvh" } as Record<string, string>)[input.restecg])],
    [t("field.slope"), t(`field.slope.${input.slope}`)],
  ];
  return <article className="assessment-print">
    <p>HeartGuard</p><h1>{vi ? "Phiếu đánh giá nguy cơ tim mạch" : "Cardiovascular risk assessment"}</h1>
    <p>{snapshot.inputs.name_prediction}</p><p>{new Date(snapshot.createdAt).toLocaleString(vi ? "vi-VN" : "en-GB")}</p>
    <table><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
    <h2>{vi ? "Kết quả từ hệ thống" : "System result"}</h2>
    <p>{vi ? "Mức nguy cơ" : "Risk level"}: {snapshot.result.ai_prediction.risk_level}</p>
    <p>{vi ? "Giá trị mô hình trả về" : "Model output"}: {(snapshot.result.ai_prediction.probability * 100).toFixed(1)}%</p>
    <p>{vi ? "Điểm lâm sàng" : "Clinical score"}: {(snapshot.result.clinical_evaluation.probability * 10).toFixed(1)} / 10</p>
    <p>BMI: {snapshot.result.bmi?.toFixed(1) ?? "—"}</p>
    <p>{snapshot.result.ai_prediction.message}</p>
    <p className="mt-4">{vi ? "Kết quả tham khảo, không thay thế chẩn đoán của bác sĩ. Phiếu sử dụng dữ liệu tại thời điểm gửi đánh giá." : "For reference, not a medical diagnosis. This report uses the inputs submitted for this assessment."}</p>
  </article>;
}
