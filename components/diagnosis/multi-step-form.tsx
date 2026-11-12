"use client";

import { useRef, useState } from "react";
import { fillFromProfile, validateAssessment, AssessmentSnapshot } from "@/lib/assessment";
import { AssessmentActions, AssessmentPrint } from "./assessment-actions";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ENDPOINTS } from "@/lib/api-config";
import { getAccessToken } from "@/lib/client-session";
import { apiErrorMessage } from "@/lib/api-errors";
import {
  Loader2,
  Heart,
  AlertTriangle,
  User,
  Activity,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { ResultDisplay } from "./result-display";
import HeartChatbot from "../chatbot/lazy-heart-chatbot";

interface ResultDetail {
  probability: number;
  risk_level: string;
  message: string;
}

interface PredictionResult {
  ai_prediction: ResultDetail;
  clinical_evaluation: ResultDetail;
  prediction: number;
  bmi: number | null;
}

interface FormData {
  age: string;
  sex: string;
  height: string;
  weight: string;
  trestbps: string;
  chol: string;
  thalch: string;
  oldpeak: string;
  fbs: string;
  exang: string;
  cp: string;
  restecg: string;
  slope: string;
  name_prediction: string;
}

const defaultFormData: FormData = {
  age: "",
  sex: "",
  height: "",
  weight: "",
  trestbps: "",
  chol: "",
  thalch: "",
  oldpeak: "",
  fbs: "0",
  exang: "0",
  cp: "asymptomatic",
  restecg: "normal",
  slope: "flat",
  name_prediction: "",
};

export function MultiStepDiagnosisForm() {
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [snapshot, setSnapshot] = useState<AssessmentSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const submitting = useRef(false);

  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileNotice("");
    setError("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error(language === "vi" ? "Vui lòng đăng nhập lại." : "Please sign in again.");
      const response = await fetch(API_ENDPOINTS.userInfo, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const profile = await response.json();
      setFormData((current) => fillFromProfile(current, profile ?? {}));
      setProfileNotice(
        language === "vi"
          ? "Đã đọc hồ sơ và bổ sung thông tin hợp lệ vào ô trống. Bạn có thể chỉnh sửa lại trước khi đánh giá."
          : "Profile checked; valid values were added to empty fields. Review before submitting."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải hồ sơ.");
    } finally {
      setProfileLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getAgeBinning = (age: number) => ({ age_under_40: age < 40 ? 1 : 0 });

  const mapChestPain = (cp: string) => ({
    cp_typical_angina: cp === "typical_angina" ? 1 : 0,
    cp_atypical_angina: cp === "atypical_angina" ? 1 : 0,
    cp_non_anginal: cp === "non_anginal" ? 1 : 0,
  });

  const mapRestEcg = (restecg: string) => ({
    restecg_normal: restecg === "normal" ? 1 : 0,
    restecg_st_t_abnormality: restecg === "st_t_abnormality" ? 1 : 0,
  });

  const mapSlope = (slope: string) => ({
    slope_flat: slope === "flat" ? 1 : 0,
    slope_upsloping: slope === "upsloping" ? 1 : 0,
  });

  const handleSubmit = async () => {
    if (submitting.current) return;

    // Validate toàn bộ 2 bước kiểm tra số và logic
    for (const step of [1, 2]) {
      const issue = validateAssessment(formData, step, language === "vi");
      if (issue) {
        setError(issue);
        return;
      }
    }

    submitting.current = true;
    setIsLoading(true);
    setError("");
    setResult(null);
    setSnapshot(null);

    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error(language === "vi" ? "Vui lòng đăng nhập để thực hiện chẩn đoán." : "Please sign in to run a prediction.");
      }
      const ageNum = parseFloat(formData.age);
      const bpNum = parseFloat(formData.trestbps);
      const requiredNumbers = {
        age: ageNum,
        trestbps: bpNum,
        chol: parseFloat(formData.chol),
        thalch: parseFloat(formData.thalch),
        oldpeak: parseFloat(formData.oldpeak),
      };
      if (Object.values(requiredNumbers).some((value) => !Number.isFinite(value))) {
        throw new Error(language === "vi" ? "Vui lòng nhập đầy đủ các chỉ số dạng số." : "Please enter all required numeric values.");
      }
      const hasHeight = formData.height.trim() !== "";
      const hasWeight = formData.weight.trim() !== "";
      if (hasHeight !== hasWeight) {
        throw new Error(language === "vi" ? "Vui lòng nhập cả chiều cao và cân nặng, hoặc để trống cả hai." : "Enter both height and weight, or leave both empty.");
      }
      const height = hasHeight ? parseFloat(formData.height) : null;
      const weight = hasWeight ? parseFloat(formData.weight) : null;

      const payload = {
        age: ageNum,
        sex: formData.sex === "1" ? 1 : 0,
        trestbps: bpNum,
        chol: requiredNumbers.chol,
        fbs: parseInt(formData.fbs),
        thalch: requiredNumbers.thalch,
        exang: parseInt(formData.exang),
        oldpeak: requiredNumbers.oldpeak,
        ...mapChestPain(formData.cp),
        ...mapRestEcg(formData.restecg),
        ...mapSlope(formData.slope),
        bp_age_ratio: bpNum / ageNum,
        include_bmi: hasHeight && hasWeight,
        height,
        weight,
        ...getAgeBinning(ageNum),
        ca_missing: 0,
        thal_missing: 0,
        dataset_Hungary: 0,
        dataset_Switzerland: 0,
        dataset_VA_Long_Beach: 0,
        risk_score: 0,
        risk_score_binary: 0,
        name_prediction: formData.name_prediction || "default",
      };

      const url = API_ENDPOINTS.predict || "/api/predict";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await apiErrorMessage(response));
      }

      const data = await response.json();
      setResult(data);
      setSnapshot({ inputs: { ...formData }, result: data, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed. Please try again.");
      console.error("Prediction error:", err);
    } finally {
      setIsLoading(false);
      submitting.current = false;
    }
  };

  const handleReset = () => {
    setFormData(defaultFormData);
    setResult(null);
    setSnapshot(null);
    setProfileNotice("");
    setError("");
  };

  const isFormValid =
    formData.age &&
    formData.sex &&
    formData.trestbps &&
    formData.chol &&
    formData.thalch &&
    formData.oldpeak;

  return (
    <div className="assessment-container mx-auto max-w-7xl">
      <div className="assessment-screen">
        <div className="grid items-start gap-6 lg:grid-cols-5">
          {/* Main Form Panel */}
          <div className="min-w-0 lg:col-span-3">
            <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-white p-6">
                <CardTitle className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Heart className="h-5 w-5" />
                  </span>
                  {language === "vi" ? "Phiếu nhập chỉ số đánh giá" : "Clinical Indicators Input Form"}
                </CardTitle>
                <CardDescription className="ml-[52px] text-xs sm:text-sm text-slate-500">
                  {language === "vi"
                    ? "Nhập đầy đủ các thông tin sức khỏe dưới đây và nhấn đánh giá để nhận kết quả phân tích AI"
                    : "Fill in the clinical indicators below to receive real-time AI cardiovascular risk assessment"}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <fieldset disabled={isLoading || profileLoading} className="min-w-0 space-y-7">
                  {/* SECTION 1: THÔNG TIN CƠ BẢN */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <User className="h-4 w-4 text-sky-600" />
                        <span className="text-sm uppercase tracking-wide">
                          {language === "vi" ? "1. Thông tin cơ bản" : "1. Basic Information"}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium border-sky-200 bg-sky-50/50 text-sky-700 hover:bg-sky-100"
                        onClick={loadProfile}
                        disabled={profileLoading}
                      >
                        {profileLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        {language === "vi" ? "Lấy từ hồ sơ" : "Fill from profile"}
                      </Button>
                    </div>

                    {profileNotice && (
                      <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-100" role="status">
                        {profileNotice}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="block_name" className="text-xs text-slate-600">
                        {language === "vi" ? "Tên lần đánh giá (tuỳ chọn)" : "Session Name (optional)"}
                      </Label>
                      <Input
                        id="block_name"
                        type="text"
                        maxLength={100}
                        placeholder={language === "vi" ? "VD: Kiểm tra định kỳ tháng 4" : "E.g., April regular checkup"}
                        value={formData.name_prediction}
                        onChange={(e) => updateField("name_prediction", e.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="age" className="text-xs font-semibold text-slate-700">{t("field.age")} *</Label>
                        <Input
                          id="age"
                          type="number"
                          min="1"
                          max="120"
                          placeholder="VD: 45"
                          value={formData.age}
                          onChange={(e) => updateField("age", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sex" className="text-xs font-semibold text-slate-700">{t("field.sex")} *</Label>
                        <Select
                          id="sex"
                          value={formData.sex}
                          onChange={(e) => updateField("sex", e.target.value)}
                        >
                          <option value="" disabled>{language === "vi" ? "Chọn giới tính" : "Select sex"}</option>
                          <option value="1">{t("field.sex.male")}</option>
                          <option value="0">{t("field.sex.female")}</option>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="height" className="text-xs text-slate-600">
                          {language === "vi" ? "Chiều cao (cm)" : "Height (cm)"}
                        </Label>
                        <Input
                          id="height"
                          type="number"
                          min="50"
                          max="250"
                          placeholder="VD: 170"
                          value={formData.height}
                          onChange={(e) => updateField("height", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="weight" className="text-xs text-slate-600">
                          {language === "vi" ? "Cân nặng (kg)" : "Weight (kg)"}
                        </Label>
                        <Input
                          id="weight"
                          type="number"
                          min="10"
                          max="300"
                          placeholder="VD: 70"
                          value={formData.weight}
                          onChange={(e) => updateField("weight", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CHỈ SỐ TIM MẠCH */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-semibold text-slate-900">
                      <Activity className="h-4 w-4 text-sky-600" />
                      <span className="text-sm uppercase tracking-wide">
                        {language === "vi" ? "2. Chỉ số tim mạch & xét nghiệm máu" : "2. Cardiovascular & Blood Indicators"}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="trestbps" className="text-xs font-semibold text-slate-700">{t("field.trestbps")} * (mmHg)</Label>
                        <Input
                          id="trestbps"
                          type="number"
                          min="50"
                          max="250"
                          placeholder="VD: 120"
                          value={formData.trestbps}
                          onChange={(e) => updateField("trestbps", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="chol" className="text-xs font-semibold text-slate-700">{t("field.chol")} * (mg/dl)</Label>
                        <Input
                          id="chol"
                          type="number"
                          min="50"
                          max="600"
                          placeholder="VD: 200"
                          value={formData.chol}
                          onChange={(e) => updateField("chol", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="thalch" className="text-xs font-semibold text-slate-700">{t("field.thalch")} * (nhịp/phút)</Label>
                        <Input
                          id="thalch"
                          type="number"
                          min="50"
                          max="250"
                          placeholder="VD: 150"
                          value={formData.thalch}
                          onChange={(e) => updateField("thalch", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="oldpeak" className="text-xs font-semibold text-slate-700">{t("field.oldpeak")} * (ST depression)</Label>
                        <Input
                          id="oldpeak"
                          type="number"
                          step="0.1"
                          min="-5"
                          max="10"
                          placeholder="VD: 1.5"
                          value={formData.oldpeak}
                          onChange={(e) => updateField("oldpeak", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="fbs" className="text-xs text-slate-600">{t("field.fbs")}</Label>
                        <Select
                          id="fbs"
                          value={formData.fbs}
                          onChange={(e) => updateField("fbs", e.target.value)}
                        >
                          <option value="0">{t("field.fbs.no")}</option>
                          <option value="1">{t("field.fbs.yes")}</option>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="exang" className="text-xs text-slate-600">{t("field.exang")}</Label>
                        <Select
                          id="exang"
                          value={formData.exang}
                          onChange={(e) => updateField("exang", e.target.value)}
                        >
                          <option value="0">{t("field.fbs.no")}</option>
                          <option value="1">{t("field.fbs.yes")}</option>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: TRIỆU CHỨNG & ĐIỆN TÂM ĐỒ */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-semibold text-slate-900">
                      <Stethoscope className="h-4 w-4 text-sky-600" />
                      <span className="text-sm uppercase tracking-wide">
                        {language === "vi" ? "3. Triệu chứng lâm sàng & Điện tâm đồ" : "3. Clinical Symptoms & ECG"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cp" className="text-xs font-semibold text-slate-700">{t("field.cp")} *</Label>
                      <Select
                        id="cp"
                        value={formData.cp}
                        onChange={(e) => updateField("cp", e.target.value)}
                      >
                        <option value="typical_angina">{t("field.cp.typical")}</option>
                        <option value="atypical_angina">{t("field.cp.atypical")}</option>
                        <option value="non_anginal">{t("field.cp.nonAnginal")}</option>
                        <option value="asymptomatic">{t("field.cp.asymptomatic")}</option>
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="restecg" className="text-xs font-semibold text-slate-700">{t("field.restecg")} *</Label>
                        <Select
                          id="restecg"
                          value={formData.restecg}
                          onChange={(e) => updateField("restecg", e.target.value)}
                        >
                          <option value="normal">{t("field.restecg.normal")}</option>
                          <option value="st_t_abnormality">{t("field.restecg.sttwave")}</option>
                          <option value="lv_hypertrophy">{t("field.restecg.lvh")}</option>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="slope" className="text-xs font-semibold text-slate-700">{t("field.slope")} *</Label>
                        <Select
                          id="slope"
                          value={formData.slope}
                          onChange={(e) => updateField("slope", e.target.value)}
                        >
                          <option value="upsloping">{t("field.slope.upsloping")}</option>
                          <option value="flat">{t("field.slope.flat")}</option>
                          <option value="downsloping">{t("field.slope.downsloping")}</option>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3.5 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* NÚT THỰC HIỆN ĐÁNH GIÁ */}
                  <div className="border-t border-slate-100 pt-5">
                    <Button
                      type="button"
                      className="h-12 w-full text-base font-semibold shadow-sm transition hover:shadow"
                      onClick={handleSubmit}
                      disabled={isLoading || !isFormValid}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t("common.loading")}
                        </>
                      ) : (
                        <>
                          <Heart className="mr-2 h-5 w-5 text-rose-300" />
                          {language === "vi" ? "Xem kết quả đánh giá nguy cơ" : "Analyze and View Results"}
                        </>
                      )}
                    </Button>
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          </div>

          {/* Result Panel Sticky */}
          <div className="min-w-0 lg:col-span-2">
            <div className="sticky top-24 min-h-[420px] space-y-4">
              <ResultDisplay result={result} onReset={handleReset} />
              {snapshot && <AssessmentActions key={snapshot.createdAt} snapshot={snapshot} />}
            </div>
          </div>
        </div>
        <HeartChatbot latestResult={result} />
      </div>
      {snapshot && <AssessmentPrint snapshot={snapshot} />}
    </div>
  );
}
