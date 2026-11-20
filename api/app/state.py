from mysql.connector.pooling import MySQLConnectionPool
from httpx import AsyncClient


class AppState:
    def __init__(self):
        self.model         = None
        self.scaler        = None
        self.feature_names = None
        self.pipeline_v2   = None
        self.model_card    = None
        self.db_pool: MySQLConnectionPool = None
        self.groq_ready: bool = False
        self.http_client: AsyncClient | None = None

state = AppState()
