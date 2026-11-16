"""
main.py
"""
import json
import logging
import os
from contextlib import asynccontextmanager
import joblib
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector.pooling import MySQLConnectionPool
from app.config import (
    ALLOWED_ORIGINS,
    DB_CONFIG,
    DB_POOL_SIZE,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_CONNECT_TIMEOUT_SECONDS,
    GROQ_READ_TIMEOUT_SECONDS,
    MODEL_CARD_V2_PATH,
    PIPELINE_V2_PATH,
)
from app.database import init_db
from app.routers.chatbot import router as chatbot_router
from app.routers.predictions import router as predictions_router
from app.routers.users import router as users_router
from app.state import state
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Khoi dong He thong Du doan Tim mach (v2)...")  
    for label, path in [("Pipeline v2", PIPELINE_V2_PATH), ("Model Card v2", MODEL_CARD_V2_PATH)]:
        if not os.path.exists(path):
            logger.critical("Khong tim thay %s tai: %s. He thong dung.", label, path)
            raise FileNotFoundError(f"Missing {label} file: {path}")
    try:
        state.pipeline_v2 = joblib.load(PIPELINE_V2_PATH)
        with open(MODEL_CARD_V2_PATH, "r", encoding="utf-8") as f:
            state.model_card = json.load(f)
        logger.info(
            "Da nap Pipeline v2 (%s, threshold=%.4f)",
            state.model_card.get("model"),
            state.model_card.get("threshold", 0.5),
        )
    except Exception as e:
        logger.critical("Loi nap Pipeline v2: %s", str(e))
        raise
    try:
        state.db_pool = MySQLConnectionPool(pool_name="mypool", pool_size=DB_POOL_SIZE, **DB_CONFIG)
        logger.info("Khoi tao Database connection pool thanh cong")
        init_db()
        logger.info("Co so du lieu da san sang")
    except Exception as e:
        logger.critical("Ket noi Database that bai: %s", str(e))
        raise
    if GROQ_API_KEY and GROQ_API_KEY.startswith("gsk_"):
        state.groq_ready = True
        logger.info("Da cau hinh Groq | Model: %s", GROQ_MODEL)
    else:
        state.groq_ready = False
        logger.warning("GROQ_API_KEY khong hop le - Chatbot tu van se tam khoa.")
    timeout = httpx.Timeout(connect=GROQ_CONNECT_TIMEOUT_SECONDS, read=GROQ_READ_TIMEOUT_SECONDS, write=10, pool=5)
    async with httpx.AsyncClient(
        timeout=timeout,
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
    ) as client:
        state.http_client = client
        try:
            yield
        finally:
            state.http_client = None
    logger.info("Da dong ket noi va dung he thong.")


app = FastAPI(
    title="Heart Disease Prediction API",
    description="API chuẩn đoán nguy cơ bệnh tim mạch dựa trên mô hình học máy",
    version="3.0",
    lifespan=lifespan,
)

if ALLOWED_ORIGINS and ALLOWED_ORIGINS[0] == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(users_router)
app.include_router(predictions_router)
app.include_router(chatbot_router)

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "database": "connected" if state.db_pool else "error",
        "ml_model": "loaded" if state.model else "error",
        "ml_features": "loaded" if state.feature_names else "error",
        "chatbot_ai": "ready" if state.groq_ready else "disabled"
    }
