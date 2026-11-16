"""
ml.py
"""
from typing import Optional, Tuple
import pandas as pd
from app.state import state

def calculate_bmi(height: float, weight: float) -> Optional[float]:
    """Tính toán chỉ số BMI tự động."""
    if height and weight and height > 0:
        return round(weight / (height / 100) ** 2, 1)
    return None

def get_risk_level(probability: float, bands: Optional[dict] = None) -> str:
    if bands:
        if probability < bands["low"]:
            return "THẤP"
        if probability < bands["medium"]:
            return "TRUNG BÌNH"
        return "CAO" if probability < bands["high"] else "RẤT CAO"
    if probability <= 0.3: return "THẤP"
    if probability <= 0.6: return "TRUNG BÌNH"
    return "CAO" if probability <= 0.8 else "RẤT CAO"

def calculate_clinical_score(data: dict) -> float:
    """Tính điểm lâm sàng dựa trên các chỉ số cốt lõi của tim mạch."""
    points = 0
    if data.get("age", 0) > 60:    points += 3
    elif data.get("age", 0) > 45:  points += 1
    
    if data.get("trestbps", 0) > 160: points += 3
    elif data.get("trestbps", 0) > 140: points += 1
    
    if data.get("chol", 0) > 240: points += 1
    if str(data.get("exang")) == "1": points += 2   

    if data.get("oldpeak", 0.0) > 2.0:  points += 2
    elif data.get("oldpeak", 0.0) > 1.0: points += 1
    
    return round(min(points / 12, 1.0), 4)

def run_inference(pipeline, model_card: dict, d: dict) -> Tuple[int, float]:
    cols = model_card["features"]["numeric"] + model_card["features"]["categorical"]
    num_set = set(model_card["features"]["numeric"])
    row = {c: (float(d[c]) if c in num_set else str(d[c])) for c in cols}
    df = pd.DataFrame([row])[cols]
    prob_disease = float(pipeline.predict_proba(df)[0][1])   # Luôn lấy P(có bệnh)
    pred = int(prob_disease >= model_card["threshold"])
    return pred, prob_disease