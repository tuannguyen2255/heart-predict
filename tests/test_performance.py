"""Regression checks without a running MySQL server, model files, or external AI."""
import asyncio
from argparse import Namespace
from datetime import datetime
import io
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import Mock, patch
from contextlib import redirect_stdout

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import httpx
from mysql.connector.errors import PoolError
from app.auth import get_current_user
from app.database import get_conn
from app.routers import predictions, chatbot
from app.state import state
from migrate_indexes import migrate, INDEXES
from scripts.load_test import run as load_run


def make_app():
    app = FastAPI()
    app.include_router(predictions.router)
    app.include_router(chatbot.router)
    app.dependency_overrides[get_current_user] = lambda: "alice"

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    return app


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(make_app())
        self.conn = Mock()
        self.cursor = self.conn.cursor.return_value
        self.cursor.fetchone.return_value = (7,)
        self.cursor.fetchall.return_value = [(9, "Check", 0, "LOW", datetime(2026, 1, 1))]

    def test_history_is_scoped_bounded_and_search_is_parameterized(self):
        with patch.object(predictions, "get_conn", return_value=self.conn):
            response = self.client.get("/prediction/history", params={"limit": 21, "offset": 20, "q": "' OR 1=1 --"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], 9)
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("WHERE user_id = %s", sql)
        self.assertIn("ORDER BY timestamp DESC, id DESC LIMIT %s OFFSET %s", sql)
        self.assertNotIn("' OR 1=1 --", sql)
        self.assertEqual(params, (7, "' OR 1=1 --", "' OR 1=1 --", 21, 20))
        self.cursor.close.assert_called_once()
        self.conn.close.assert_called_once()

    def test_invalid_pagination_does_not_query_database(self):
        with patch.object(predictions, "get_conn") as connect:
            for query in ("limit=0", "limit=101", "offset=-1", "offset=100001", "q=" + "x" * 101):
                with self.subTest(query=query):
                    self.assertEqual(self.client.get("/prediction/history?" + query).status_code, 422)
            connect.assert_not_called()

    def test_missing_user_preserves_404(self):
        self.cursor.fetchone.return_value = None
        with patch.object(predictions, "get_conn", return_value=self.conn):
            self.assertEqual(self.client.get("/prediction/history").status_code, 404)
        self.conn.close.assert_called_once()

    def test_authentication_required(self):
        app = make_app()
        app.dependency_overrides.clear()
        with patch.object(predictions, "get_conn") as connect:
            self.assertEqual(TestClient(app).get("/prediction/history").status_code, 401)
            connect.assert_not_called()

    def test_chat_page_returns_oldest_to_newest_with_bound(self):
        self.cursor.fetchall.return_value = [("assistant", "new"), ("user", "old")]
        with patch.object(chatbot, "get_conn", return_value=self.conn):
            response = self.client.get("/chatbot/history?limit=2&offset=4")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([m["content"] for m in response.json()], ["old", "new"])
        self.assertEqual(self.cursor.execute.call_args.args[1], (7, 2, 4))

    def test_pool_exhaustion_returns_retryable_503(self):
        pool = Mock()
        pool.get_connection.side_effect = PoolError("busy")
        with patch.object(state, "db_pool", pool), self.assertRaises(HTTPException) as error:
            get_conn()
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.headers, {"Retry-After": "1"})

    def test_index_migration_is_repeatable(self):
        conn = Mock()
        cursor = conn.cursor.return_value
        cursor.fetchone.return_value = (0,)
        with redirect_stdout(io.StringIO()):
            migrate(conn)
        creates = [c for c in cursor.execute.call_args_list if c.args[0].startswith("CREATE INDEX")]
        self.assertEqual(len(creates), len(INDEXES))
        cursor.reset_mock()
        cursor.fetchone.return_value = (1,)
        migrate(conn)
        self.assertFalse(any(c.args[0].startswith("CREATE INDEX") for c in cursor.execute.call_args_list))


class ConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_inference_does_not_block_health(self):
        started, release = threading.Event(), threading.Event()

        def slow_inference(*args):
            started.set()
            release.wait(timeout=3)
            return 0, 0.1

        payload = json.loads((Path(__file__).parents[1] / "scripts/predict_payload.json").read_text())
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=make_app()), base_url="http://test") as client:
            with patch.object(state, "pipeline_v2", object()), patch.object(state, "model_card", {"risk_bands": {"low": 0.2, "medium": 0.4, "high": 0.7}}), patch.object(predictions, "run_inference", slow_inference):
                prediction = asyncio.create_task(client.post("/predict", json=payload))
                try:
                    self.assertTrue(await asyncio.to_thread(started.wait, 1))
                    response = await asyncio.wait_for(client.get("/health"), timeout=1)
                    self.assertEqual(response.status_code, 200)
                    self.assertFalse(prediction.done(), "Prediction should still be waiting in the worker")
                finally:
                    release.set()
                    self.assertEqual((await prediction).status_code, 200)

    async def test_chat_releases_db_before_network_and_saves_in_worker(self):
        read_conn, write_conn = Mock(), Mock()
        cursor = read_conn.cursor.return_value
        cursor.fetchone.side_effect = [{"id": 7}, {"count": 0}]
        cursor.fetchall.return_value = [{"role": "user", "content": "previous"}]
        loop_thread = threading.get_ident()
        threads = []

        def connect():
            threads.append(threading.get_ident())
            return read_conn if len(threads) == 1 else write_conn

        async def groq(messages):
            read_conn.close.assert_called_once()
            self.assertEqual(messages[-1]["content"], "hello")
            return "answer"

        with patch.object(state, "groq_ready", True), patch.object(chatbot, "get_conn", side_effect=connect), patch.object(chatbot, "_call_groq", groq):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=make_app()), base_url="http://test") as client:
                response = await client.post("/chatbot", json={"message": "hello"})
        self.assertTrue(response.json()["response"].startswith("answer"))
        self.assertTrue(all(t != loop_thread for t in threads))
        write_conn.commit.assert_called_once()
        write_conn.close.assert_called_once()

    async def test_load_runner_counts_errors_and_fails_threshold(self):
        # Exercise the real request scheduler/metrics with a deterministic transport.
        client_type = httpx.AsyncClient
        count = 0

        def respond(request):
            nonlocal count
            count += 1
            return httpx.Response(503 if count % 4 == 0 else 200, json={})

        args = Namespace(scenario="health", payload=None, concurrency=3, requests=20,
                         warmup=0, timeout=2, base_url="http://test", output=None,
                         max_error_rate=0.01, max_p95_ms=None)
        def client_factory(**kwargs):
            return client_type(transport=httpx.MockTransport(respond), **kwargs)

        output = io.StringIO()
        with patch("scripts.load_test.httpx.AsyncClient", side_effect=client_factory), redirect_stdout(output):
            passed = await load_run(args)
        report = json.loads(output.getvalue())
        self.assertFalse(passed)
        self.assertEqual(report["status_codes"], {"200": 15, "503": 5})
        self.assertEqual(report["failure_rate"], 0.25)


if __name__ == "__main__":
    unittest.main()
