"""
schemas.py
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ── Auth / User ───────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username:         str
    password:         str
    confirm_password: str
    email:            Optional[str] = None
    phone:            Optional[str] = None
    accepted_terms:   bool = False
    age_confirmed:    bool = False
    research_consent: bool = False
    terms_version:    Optional[str] = None

class AcceptTermsRequest(BaseModel):
    terms_version:    str
    age_confirmed:    bool = True
    research_consent: bool = True

class DeleteAccountRequest(BaseModel):
    reason:           str = Field(..., min_length=5, max_length=500)

class PasswordChange(BaseModel):
    new_password: str

class PremiumStatusResponse(BaseModel):
    username:      str
    is_premium:    bool
    chat_limit:    int
    premium_until: Optional[datetime] = None

class ProfileUpdateInput(BaseModel):
    age:            Optional[int]   = Field(None, ge=0, le=120)
    sex:            Optional[int]   = Field(None, ge=0, le=1)
    height:         Optional[float] = Field(None, ge=50, le=250)
    weight:         Optional[float] = Field(None, ge=10, le=300)
    blood_pressure: Optional[int]   = Field(None, ge=50, le=250)
    cholesterol:    Optional[int]   = Field(None, ge=100, le=600)

# ── Prediction ────────────────────────────────────────────────────────────────
from typing import Literal, Optional

class PredictionInput(BaseModel):
    age:         float = Field(..., ge=1, le=120)
    sex:         Literal["0", "1"]
    trestbps:    float = Field(..., ge=50, le=250)
    chol:        float = Field(..., ge=50, le=600)
    thalch:      float = Field(..., ge=50, le=250)
    oldpeak:     float = Field(..., ge=-5, le=10)
    fbs:         Literal["0", "1"] = "0"
    exang:       Literal["0", "1"] = "0"
    cp:          Literal["typical_angina", "atypical_angina", "non_anginal", "asymptomatic"]
    restecg:     Literal["normal", "st_t_abnormality", "lv_hypertrophy"]
    slope:       Literal["upsloping", "flat", "downsloping"]
    height:      Optional[float] = Field(None, ge=50, le=250)
    weight:      Optional[float] = Field(None, ge=10, le=300)
    include_bmi: bool = False

class AIDetails(BaseModel):
    probability: float
    risk_level: str
    message: str

class ClinicalDetails(BaseModel):
    probability: float
    risk_level: str
    message: str

class PredictionOutput(BaseModel):
    ai_prediction: AIDetails
    clinical_evaluation: ClinicalDetails
    prediction: int
    bmi: Optional[float] = None


class SaveHistoryInput(BaseModel):
    name_prediction:   str
    prediction_result: int
    clinical_score:    float
    probability:       float
    risk_level:        str
    inputs:            Optional[Dict[str, Any]] = None

# ── Chatbot ───────────────────────────────────────────────────────────────────
class ChatMessageInput(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)

class ChatMessageOutput(BaseModel):
    reply: str

ChatInput = ChatMessageInput
ChatOutput = ChatMessageOutput
