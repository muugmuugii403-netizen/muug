"""API smoke тестүүд — Step 1-ийн contract-ийг баталгаажуулна.

Ажиллуулах: make test  (эсвэл cd backend && .venv/bin/pytest -q)
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

API = "/api/v1"


def test_health_returns_ok() -> None:
    res = client.get(f"{API}/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["version"] == "v1"
    assert "utc_now" in body


def test_pairs_contains_majors() -> None:
    res = client.get(f"{API}/pairs")
    assert res.status_code == 200
    symbols = {p["symbol"] for p in res.json()}
    assert {"EUR/USD", "GBP/USD", "USD/JPY"} <= symbols


def test_analysis_stub_returns_501() -> None:
    """Оролт зөв боловч engine хараахан хэрэгжээгүй → 501 + нэгдсэн алдааны формат."""
    res = client.post(f"{API}/analysis", json={"symbol": "EUR/USD", "timeframe": "1h"})
    assert res.status_code == 501
    body = res.json()
    assert body["error"] == "not_implemented"
    assert body["path"] == f"{API}/analysis"


def test_analysis_rejects_bad_symbol() -> None:
    """Symbol формат буруу бол 422 + validation_error код."""
    res = client.post(f"{API}/analysis", json={"symbol": "btcusd", "timeframe": "1h"})
    assert res.status_code == 422
    assert res.json()["error"] == "validation_error"


def test_analysis_rejects_unknown_timeframe() -> None:
    res = client.post(f"{API}/analysis", json={"symbol": "EUR/USD", "timeframe": "2h"})
    assert res.status_code == 422
    assert res.json()["error"] == "validation_error"
