"""健康检查接口测试。"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_service_status() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "japanese-lyrics-api",
        "version": "0.1.0",
    }


def test_health_allows_local_frontend_origin() -> None:
    response = client.get(
        "/api/health",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )


def test_cors_preflight_allows_shared_document_methods() -> None:
    for method in ("PUT", "PATCH", "DELETE"):
        response = client.options(
            "/api/documents/doc-test",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": (
                    "authorization,content-type"
                ),
            },
        )

        assert response.status_code == 200
        assert method in response.headers["access-control-allow-methods"]

