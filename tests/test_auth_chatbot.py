import asyncio
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import httpx
from app.auth import get_current_user
from app.routers import chatbot, predictions, users
from app.state import state


class LoginTests(unittest.TestCase):
    def test_login_token_authenticates_predict_without_bypassing_jwt(self):
        app = FastAPI()
        app.include_router(users.router)
        app.include_router(predictions.router)
        conn = Mock()
        conn.cursor.return_value.fetchone.return_value = {"id": 7, "password": "hash"}
        client = TestClient(app)
        with patch.object(users, "get_conn", return_value=conn), patch.object(users.bcrypt, "checkpw", return_value=True):
            response = client.post("/login", data={"username": "alice", "password": "test-only"})
        self.assertEqual(response.status_code, 200)
        token = response.json()["access_token"]
        self.assertEqual(get_current_user(token), "alice")
        payload = json.loads((Path(__file__).parents[1] / "scripts/predict_payload.json").read_text())
        with patch.object(state, "model", object()), patch.object(state, "feature_names", ["age"]), patch.object(predictions, "run_inference", return_value=(0, 0.1)):
            self.assertEqual(client.post("/predict", json=payload, headers={"Authorization": f"Bearer {token}"}).status_code, 200)
            self.assertEqual(client.post("/predict", json=payload, headers={"Authorization": "Bearer null"}).status_code, 401)

    def test_prediction_schema_accepts_negative_oldpeak_from_training_domain(self):
        from app.schemas import PredictionInput
        payload = json.loads((Path(__file__).parents[1] / "scripts/predict_payload.json").read_text())
        payload["oldpeak"] = -2.6
        self.assertEqual(PredictionInput(**payload).oldpeak, -2.6)

    def test_prediction_schema_rejects_values_outside_supported_oldpeak_range(self):
        from pydantic import ValidationError
        from app.schemas import PredictionInput
        payload = json.loads((Path(__file__).parents[1] / "scripts/predict_payload.json").read_text())
        for value in (-5.1, 10.1):
            payload["oldpeak"] = value
            with self.subTest(value=value), self.assertRaises(ValidationError):
                PredictionInput(**payload)


class GroqTests(unittest.IsolatedAsyncioTestCase):
    async def call_with_transport(self, handler):
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with patch.object(state, "http_client", client), patch.object(chatbot, "GROQ_API_KEY", "test-only"):
                return await chatbot._call_groq([{"role": "user", "content": "test-only"}])

    async def test_success_caps_output(self):
        def respond(request):
            body = json.loads(request.content)
            self.assertEqual(body["max_completion_tokens"], chatbot.GROQ_MAX_COMPLETION_TOKENS)
            return httpx.Response(200, json={"choices": [{"message": {"content": "OK"}}]})
        self.assertEqual(await self.call_with_transport(respond), "OK")

    async def test_read_timeout_is_504_and_not_retried(self):
        count = 0
        def respond(request):
            nonlocal count
            count += 1
            raise httpx.ReadTimeout("test timeout", request=request)
        with self.assertLogs(chatbot.logger, level="WARNING") as logs:
            with self.assertRaises(HTTPException) as error:
                await self.call_with_transport(respond)
        self.assertEqual(error.exception.status_code, 504)
        self.assertIn("X-Request-ID", error.exception.headers)
        self.assertIn("kind=ReadTimeout", logs.output[0])
        self.assertNotIn("test-only", logs.output[0])
        self.assertEqual(count, 1)

    async def test_pool_timeout_is_503(self):
        def respond(request):
            raise httpx.PoolTimeout("test pool full", request=request)
        with self.assertRaises(HTTPException) as error:
            await self.call_with_transport(respond)
        self.assertEqual(error.exception.status_code, 503)

    async def test_provider_auth_is_not_browser_auth_error(self):
        for status, expected in ((401, 502), (404, 502), (429, 503), (504, 504)):
            with self.subTest(status=status), self.assertRaises(HTTPException) as error:
                await self.call_with_transport(lambda r: httpx.Response(status, json={"error": "test"}))
            self.assertEqual(error.exception.status_code, expected)

    async def test_total_deadline_bounds_slow_provider(self):
        async def respond(request):
            await asyncio.sleep(1)
            return httpx.Response(200, json={})
        with patch.object(chatbot, "GROQ_REQUEST_TIMEOUT_SECONDS", 0.01), self.assertRaises(HTTPException) as error:
            await self.call_with_transport(respond)
        self.assertEqual(error.exception.status_code, 504)

    async def test_malformed_provider_response_is_502(self):
        for body in ({}, {"choices": [{"message": {"content": None}}]}):
            with self.assertRaises(HTTPException) as error:
                await self.call_with_transport(lambda r: httpx.Response(200, json=body))
            self.assertEqual(error.exception.status_code, 502)

    async def test_timeout_does_not_save_chat(self):
        app = FastAPI()
        app.include_router(chatbot.router)
        app.dependency_overrides[get_current_user] = lambda: "alice"
        async def timeout(messages):
            raise HTTPException(status_code=504, detail="test timeout")
        with patch.object(state, "groq_ready", True), patch.object(chatbot, "_load_chat_context", return_value=(7, [])), patch.object(chatbot, "_call_groq", timeout), patch.object(chatbot, "_save_chat_exchange") as save:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post("/chatbot", json={"message": "test-only"})
        self.assertEqual(response.status_code, 504)
        save.assert_not_called()


if __name__ == "__main__":
    unittest.main()
