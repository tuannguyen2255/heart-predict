export interface AssessmentInputs {
  age: string; sex: string; height: string; weight: string;
  trestbps: string; chol: string; thalch: string; oldpeak: string;
  fbs: string; exang: string; cp: string; restecg: string; slope: string;
  name_prediction: string;
}
export interface AssessmentResult {
  ai_prediction: { probability: number; risk_level: string; message: string };
  clinical_evaluation: { probability: number; risk_level: string; message: string };
  prediction: number;
  bmi: number | null;
}
export interface AssessmentSnapshot {
  inputs: AssessmentInputs;
  result: AssessmentResult;
  createdAt: string;
}
// Accepted application ranges, not clinical reference ranges.
export const numericRanges = {
  age: [1, 120], height: [50, 250], weight: [10, 300],
  trestbps: [50, 250], chol: [50, 600], thalch: [50, 250], oldpeak: [-5, 10],
} as const;
const labels = {
  age: ["Tuổi", "Age"], height: ["Chiều cao", "Height"], weight: ["Cân nặng", "Weight"],
  trestbps: ["Huyết áp", "Blood pressure"], chol: ["Cholesterol", "Cholesterol"],
  thalch: ["Nhịp tim tối đa", "Maximum heart rate"], oldpeak: ["Độ chênh ST", "ST depression"],
};
export function validateAssessment(inputs: AssessmentInputs, step: number, vi = true): string | null {
  if (step === 1 && !["0", "1"].includes(inputs.sex)) return vi ? "Vui lòng chọn giới tính." : "Please select sex.";
  const fields: (keyof typeof numericRanges)[] = step === 1 ? ["age", "height", "weight"] : step === 2 ? ["trestbps", "chol", "thalch", "oldpeak"] : [];
  for (const field of fields) {
    if ((field === "height" || field === "weight") && !inputs[field].trim()) continue;
    const [min, max] = numericRanges[field];
    const value = Number(inputs[field]);
    if (!inputs[field].trim() || !Number.isFinite(value) || value < min || value > max) {
      return vi ? `${labels[field][0]}: nhập giá trị từ ${min} đến ${max}.` : `${labels[field][1]}: enter a value between ${min} and ${max}.`;
    }
  }
  if (step === 1 && Boolean(inputs.height.trim()) !== Boolean(inputs.weight.trim())) return vi ? "Nhập cả chiều cao và cân nặng, hoặc để trống cả hai." : "Enter both height and weight, or leave both empty.";
  return null;
}

// Reuse only valid profile values. Never overwrite a user's entry.
export function fillFromProfile(inputs: AssessmentInputs, profile: Record<string, unknown>): AssessmentInputs {
  const next = { ...inputs };
  const mapping = { age: "age", height: "height", weight: "weight", trestbps: "blood_pressure", chol: "cholesterol" } as const;
  for (const field of Object.keys(mapping) as (keyof typeof mapping)[]) {
    const raw = profile[mapping[field]];
    if (next[field].trim() || raw === null || raw === undefined || (typeof raw !== "number" && typeof raw !== "string") || String(raw).trim() === "") continue;
    const value = Number(raw);
    const [min, max] = numericRanges[field];
    if (Number.isFinite(value) && value >= min && value <= max) next[field] = String(value);
  }
  if (!next.sex && (profile.sex === 0 || profile.sex === 1 || profile.sex === "0" || profile.sex === "1")) next.sex = String(profile.sex);
  return next;
}

export function historyPayload(snapshot: AssessmentSnapshot) {
  return {
    name_prediction: snapshot.inputs.name_prediction.trim() || `Đánh giá ${new Date(snapshot.createdAt).toLocaleString("vi-VN")}`,
    prediction_result: snapshot.result.prediction,
    clinical_score: snapshot.result.clinical_evaluation.probability * 10,
    probability: snapshot.result.ai_prediction.probability,
    risk_level: snapshot.result.ai_prediction.risk_level,
    inputs: {
      age: snapshot.inputs.age,
      sex: snapshot.inputs.sex,
      height: snapshot.inputs.height,
      weight: snapshot.inputs.weight,
      trestbps: snapshot.inputs.trestbps,
      chol: snapshot.inputs.chol,
      thalch: snapshot.inputs.thalch,
      oldpeak: snapshot.inputs.oldpeak,
      fbs: snapshot.inputs.fbs,
      exang: snapshot.inputs.exang,
      cp: snapshot.inputs.cp,
      restecg: snapshot.inputs.restecg,
      slope: snapshot.inputs.slope,
      bmi: snapshot.result.bmi,
    },
  };
}
