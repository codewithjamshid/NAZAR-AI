from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_components():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "degraded")
    assert set(body) >= {"status", "db", "redis", "medgemma_stub"}
