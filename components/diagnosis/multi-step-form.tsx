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
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Activity,
  Stethoscope,
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
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [snapshot, setSnapshot] = useState<AssessmentSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const submitting = useRef(false);

  const loadProfile = async () => {
    setProfileLoading(true); setProfileNotice(""); setError("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error(language === "vi" ? "Vui lòng đăng nhập lại." : "Please sign in again.");
      const response = await fetch(API_ENDPOINTS.userInfo, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const profile = await response.json();
      setFormData((current) => fillFromProfile(current, profile ?? {}));
      setProfileNotice(language === "vi" ? "Đã đọc hồ sơ và bổ sung thông tin hợp lệ vào ô trống. Hãy kiểm tra lại các chỉ số trước khi tiếp tục." : "Profile checked; valid values were added to empty fields. Review the measurements before continuing.");
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể tải hồ sơ."); }
    finally { setProfileLoading(false); }
  };

  const totalSteps = 3;

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

  // ── HÀM SUBMIT DỮ LIỆU ĐÃ ĐƯỢC TỐI ƯU HÓA TOÀN DIỆN ──
  const handleSubmit = async () => {
    if (submitting.current) return;
    for (const step of [1, 2]) {
      const issue = validateAssessment(formData, step, language === "vi");
      if (issue) { setCurrentStep(step); setError(issue); return; }
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
        block_name_prediction: formData.name_prediction || "default"
      };

      // 2. CHUẨN HÓA URL: Bỏ tham số ?username= thừa vì Backend mới tự trích xuất qua Token JWT
      const url = API_ENDPOINTS.predict || "/api/predict";
      
      const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          // ── ĐÂY LÀ DÒNG CHÍ MẠNG XÓA LỖI 401 UNAUTHORIZED ──
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await apiErrorMessage(response));
      }

      const data = await response.json();

      setResult(data);
      setSnapshot({ inputs: { ...formData }, result: data, createdAt: new Date().toISOString() });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Prediction failed. Please try again.");
      console.error("Prediction error:", error);
    } finally {
      setIsLoading(false);
      submitting.current = false;
    }
  };

  const handleNext = () => {
    const issue = validateAssessment(formData, currentStep, language === "vi");
    if (issue) { setError(issue); return; }
    setError("");
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => { setError(""); if (currentStep > 1) setCurrentStep(currentStep - 1); };
  const handleReset = () => { setFormData(defaultFormData); setResult(null); setSnapshot(null); setProfileNotice(""); setError(""); setCurrentStep(1); };

  const isStep1Valid = formData.age && formData.sex;
  const isStep2Valid = formData.trestbps && formData.chol && formData.thalch && formData.oldpeak;
  const isStep3Valid = formData.cp && formData.restecg && formData.slope;

  const canProceed = () => {
    if (currentStep === 1) return isStep1Valid;
    if (currentStep === 2) return isStep2Valid;
    if (currentStep === 3) return isStep3Valid;
    return false;
  };

  const stepIcons = [User, Activity, Stethoscope];

  return (
    <div className="assessment-container mx-auto max-w-7xl">
      <div className="assessment-screen">
      {/* Progress Steps */}
      <div className="glass-panel mb-7 rounded-xl px-4 py-5 sm:px-7">
        <div className="grid grid-cols-3 gap-2 sm:gap-5">
          {[1, 2, 3].map((step) => {
            const StepIcon = stepIcons[step - 1];
            const labels = language === "vi" ? ["Thông tin cơ bản", "Chỉ số tim mạch", "Thông tin xét nghiệm"] : ["Basic info", "Cardiovascular", "Test information"];
            return (
              <div key={step} aria-current={step === currentStep ? "step" : undefined} className={`relative flex flex-col items-start gap-2 rounded-lg p-2 transition sm:flex-row sm:items-center sm:gap-3 sm:p-3.5 ${step === currentStep ? "bg-sky-50 text-primary" : "text-slate-500"}`}>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    step === currentStep
                      ? "bg-sky-500 text-white"
                      : step < currentStep
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step < currentStep ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0"><p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${step === currentStep ? "text-primary" : "text-slate-400"}`}>Bước {step}</p><p className="mt-1 text-xs font-medium sm:text-sm">{labels[step - 1]}</p></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Card className="overflow-hidden border-slate-200/70 bg-white/90">
            <CardHeader className="border-b border-slate-100 bg-white p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-950">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-500"><Heart className="h-5 w-5" /></span>
                {currentStep === 1 && (language === "vi" ? "Thông tin cơ bản" : "Basic Information")}
                {currentStep === 2 && (language === "vi" ? "Chỉ số tim mạch" : "Cardiovascular Indicators")}
                {currentStep === 3 && (language === "vi" ? "Thông tin xét nghiệm" : "Symptoms & Diagnosis")}
              </CardTitle>
              <CardDescription className="ml-[52px] text-sm">
                {language === "vi" 
                  ? `Bước ${currentStep} / ${totalSteps} - Vui lòng nhập đầy đủ thông tin`
                  : `Step ${currentStep} of ${totalSteps} - Please fill in all fields`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-6">
              <fieldset disabled={isLoading || profileLoading} className="min-w-0">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4">
                    <Button variant="outline" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal text-left" onClick={loadProfile} disabled={profileLoading}>
                      {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                      {language === "vi" ? "Lấy thông tin từ hồ sơ" : "Use profile information"}
                    </Button>
                    <p className="mt-2 text-xs leading-5 text-slate-600" role="status">{profileNotice || (language === "vi" ? "Điền nhanh các ô còn trống từ hồ sơ đã lưu. Bạn có thể chỉnh sửa trước khi gửi." : "Fill empty fields from your saved profile. You can edit the values before submitting.")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block_name">
                      {language === "vi" ? "Tên lần đánh giá (tuỳ chọn)" : "Diagnosis Session Name (optional)"}
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
                    <div className="space-y-2">
                      <Label htmlFor="age">{t("field.age")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="sex">{t("field.sex")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="height">
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
                    <div className="space-y-2">
                      <Label htmlFor="weight">
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
              )}

              {/* Step 2: Cardiovascular Indicators */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="trestbps">{t("field.trestbps")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="chol">{t("field.chol")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="thalch">{t("field.thalch")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="oldpeak">{t("field.oldpeak")} *</Label>
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
                    <div className="space-y-2">
                      <Label htmlFor="fbs">{t("field.fbs")}</Label>
                      <Select
                        id="fbs"
                        value={formData.fbs}
                        onChange={(e) => updateField("fbs", e.target.value)}
                      >
                        <option value="0">{t("field.fbs.no")}</option>
                        <option value="1">{t("field.fbs.yes")}</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exang">{t("field.exang")}</Label>
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
              )}

              {/* Step 3: Symptoms */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="cp">{t("field.cp")} *</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="restecg">{t("field.restecg")} *</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="slope">{t("field.slope")} *</Label>
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
              )}

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive mt-6">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 1}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {language === "vi" ? "Quay lại" : "Previous"}
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed()}
                  >
                    {language === "vi" ? "Tiếp theo" : "Next"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || !canProceed()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </>
                    ) : (
                      <>
                        <Heart className="mr-2 h-4 w-4" />
                        {language === "vi" ? "Xem kết quả đánh giá" : "View assessment result"}
                      </>
                    )}
                  </Button>
                )}
              </div>
              </fieldset>
            </CardContent>
          </Card>
        </div>

        {/* Result Panel */}
        <div className="min-w-0 lg:col-span-2">
          <div className="sticky top-24 min-h-[420px]">
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
