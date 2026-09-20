const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/assessment.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });
const { fillFromProfile, validateAssessment, historyPayload } = exportsObject;
const inputs = { age: "45", sex: "0", height: "", weight: "", trestbps: "120", chol: "180", thalch: "150", oldpeak: "0", name_prediction: "Kiểm tra", cp: "asymptomatic", restecg: "normal", slope: "flat", fbs: "0", exang: "0" };

test("profile fills missing valid values without overwriting user input or mutating it", () => {
  const original = { ...inputs, age: "", sex: "" };
  const next = fillFromProfile(original, { age: 52, sex: 0, blood_pressure: 135, cholesterol: 190, height: 170, weight: 65 });
  assert.equal(next.age, "52");
  assert.equal(next.sex, "0");
  assert.equal(next.trestbps, "120");
  assert.equal(next.height, "170");
  assert.equal(original.age, "");
});
test("profile ignores invalid, missing and out-of-range measurements", () => {
  const next = fillFromProfile({ ...inputs, age: "", chol: "" }, { age: null, cholesterol: "unknown", height: 0, weight: true });
  assert.equal(next.age, "");
  assert.equal(next.chol, "");
  assert.equal(next.height, "");
  assert.equal(next.weight, "");
});
test("step validation accepts optional BMI, zero oldpeak and supported negative values", () => {
  assert.equal(validateAssessment(inputs, 1), null);
  assert.equal(validateAssessment(inputs, 2), null);
  assert.equal(validateAssessment({ ...inputs, oldpeak: "-2.6", chol: "50", thalch: "250" }, 2), null);
});
test("step validation rejects incomplete BMI, zero age, missing sex and nonfinite values", () => {
  for (const patch of [{ height: "170" }, { height: "170", weight: "500" }, { age: "0" }, { sex: "" }]) assert.ok(validateAssessment({ ...inputs, ...patch }, 1));
  for (const patch of [{ trestbps: "NaN" }, { chol: "Infinity" }, { oldpeak: "-6" }, { thalch: "" }]) assert.ok(validateAssessment({ ...inputs, ...patch }, 2));
});
test("history payload uses the submitted snapshot and the API clinical-score scale", () => {
  const snapshot = { inputs: { ...inputs }, createdAt: "2026-09-20T05:00:00Z", result: { prediction: 0, bmi: null, ai_prediction: { probability: .2, risk_level: "THẤP" }, clinical_evaluation: { probability: .3 } } };
  const editedForm = { ...inputs, name_prediction: "Changed after submission" };
  const payload = historyPayload(snapshot);
  assert.equal(payload.name_prediction, "Kiểm tra");
  assert.equal(payload.clinical_score, 3);
  assert.equal(payload.probability, .2);
  assert.notEqual(payload.name_prediction, editedForm.name_prediction);
});
