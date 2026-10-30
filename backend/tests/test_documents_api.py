"""共享歌词文档与个人访问口令测试。"""

from fastapi.testclient import TestClient
import pytest

from app.api import routes_documents
from app.main import app
from app.repositories.lyrics_repository import LyricsDocumentRepository
from app.schemas.lyrics import LyricsDocument
from app.services.analyzer import LyricsAnalyzer
from app.services.romaji import build_line_romaji

TOKEN = "test-personal-token"
AUTH_HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def shared_repository(tmp_path) -> LyricsDocumentRepository:
    return LyricsDocumentRepository(str(tmp_path / "lyrics.db"))


@pytest.fixture
def clients(monkeypatch, shared_repository):
    monkeypatch.setenv("APP_ACCESS_TOKEN", TOKEN)
    monkeypatch.setattr(routes_documents, "repository", shared_repository)
    return TestClient(app), TestClient(app)


def make_document() -> LyricsDocument:
    document = LyricsAnalyzer().analyze(
        "夜空に歌う\n光の中で",
        title="测试歌曲",
        artist="测试歌手",
    )
    return document.model_copy(update={"album": "测试专辑"})


def set_confirmed_reading(
    document: LyricsDocument,
    line_index: int,
    segment_index: int,
    reading: str,
) -> LyricsDocument:
    lines = []
    for line in document.lines:
        if line.line_index != line_index:
            lines.append(line)
            continue

        segments = [
            segment.model_copy(
                update={
                    "confirmed_reading": reading
                    if segment.segment_index == segment_index
                    else segment.confirmed_reading,
                    "effective_reading": reading
                    if segment.segment_index == segment_index
                    else segment.effective_reading,
                    "needs_review": False
                    if segment.segment_index == segment_index
                    else segment.needs_review,
                }
            )
            for segment in line.segments
        ]
        lines.append(
            line.model_copy(
                update={
                    "segments": segments,
                    "romaji": build_line_romaji(segments),
                }
            )
        )

    return document.model_copy(update={"lines": lines})


def test_documents_require_access_token(clients) -> None:
    client, _ = clients

    response = client.get("/api/documents")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_save_list_and_open_shared_document(clients) -> None:
    client, second_device = clients
    document = make_document()

    save_response = client.post(
        "/api/documents",
        headers=AUTH_HEADERS,
        json={"document": document.model_dump(mode="json")},
    )

    assert save_response.status_code == 201
    saved = save_response.json()
    document_id = saved["summary"]["id"]
    assert saved["summary"]["title"] == "测试歌曲"
    assert saved["summary"]["album"] == "测试专辑"
    assert saved["document"]["album"] == "测试专辑"
    assert saved["document"]["original_text"] == "夜空に歌う\n光の中で"
    assert saved["summary"]["revision"] == 1

    list_response = second_device.get(
        "/api/documents",
        headers=AUTH_HEADERS,
    )
    assert list_response.status_code == 200
    assert list_response.json()["documents"][0]["id"] == document_id

    open_response = second_device.get(
        f"/api/documents/{document_id}",
        headers=AUTH_HEADERS,
    )
    assert open_response.status_code == 200
    assert open_response.json()["document"]["lines"][0]["original_text"] == (
        "夜空に歌う"
    )


def test_corrections_are_shared_between_clients(clients) -> None:
    client_a, client_b = clients
    document = make_document()
    saved = client_a.post(
        "/api/documents",
        headers=AUTH_HEADERS,
        json={"document": document.model_dump(mode="json")},
    ).json()
    document_id = saved["summary"]["id"]

    corrected_by_a = set_confirmed_reading(
        document,
        line_index=0,
        segment_index=0,
        reading="よる",
    )
    update_a = client_a.put(
        f"/api/documents/{document_id}",
        headers=AUTH_HEADERS,
        json={"document": corrected_by_a.model_dump(mode="json")},
    )

    assert update_a.status_code == 200
    assert update_a.json()["summary"]["revision"] == 2
    assert update_a.json()["summary"]["confirmed_count"] == 1

    seen_by_b = client_b.get(
        f"/api/documents/{document_id}",
        headers=AUTH_HEADERS,
    ).json()["document"]
    assert seen_by_b["lines"][0]["segments"][0]["confirmed_reading"] == "よる"
    assert seen_by_b["lines"][0]["romaji"] == "yoru ni utau"

    corrected_by_b = set_confirmed_reading(
        corrected_by_a,
        line_index=1,
        segment_index=0,
        reading="ひかりの",
    )
    update_b = client_b.put(
        f"/api/documents/{document_id}",
        headers=AUTH_HEADERS,
        json={"document": corrected_by_b.model_dump(mode="json")},
    )

    assert update_b.status_code == 200
    seen_by_a = client_a.get(
        f"/api/documents/{document_id}",
        headers=AUTH_HEADERS,
    ).json()["document"]
    assert seen_by_a["lines"][0]["segments"][0]["confirmed_reading"] == "よる"
    assert (
        seen_by_a["lines"][1]["segments"][0]["confirmed_reading"]
        == "ひかりの"
    )


def test_unknown_document_returns_404(clients) -> None:
    client, _ = clients
    response = client.get(
        "/api/documents/doc-missing",
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 404


def test_library_search_favorite_rename_duplicate_and_delete(clients) -> None:
    client, _ = clients
    first = client.post(
        "/api/documents",
        headers=AUTH_HEADERS,
        json={"document": make_document().model_dump(mode="json")},
    ).json()
    first_id = first["summary"]["id"]

    second_document = make_document().model_copy(
        update={"title": "另一首歌", "artist": "另一位歌手"}
    )
    second = client.post(
        "/api/documents",
        headers=AUTH_HEADERS,
        json={"document": second_document.model_dump(mode="json")},
    ).json()
    second_id = second["summary"]["id"]

    search = client.get(
        "/api/documents",
        headers=AUTH_HEADERS,
        params={"query": "另一首"},
    )
    assert search.status_code == 200
    assert [item["id"] for item in search.json()["documents"]] == [second_id]

    metadata = client.patch(
        f"/api/documents/{first_id}",
        headers=AUTH_HEADERS,
        json={
            "title": "收藏歌曲",
            "artist": "新歌手",
            "album": "新专辑",
            "is_favorite": True,
        },
    )
    assert metadata.status_code == 200
    assert metadata.json()["summary"]["title"] == "收藏歌曲"
    assert metadata.json()["summary"]["album"] == "新专辑"
    assert metadata.json()["summary"]["is_favorite"] is True
    assert metadata.json()["document"]["artist"] == "新歌手"
    assert metadata.json()["document"]["album"] == "新专辑"

    favorites = client.get(
        "/api/documents",
        headers=AUTH_HEADERS,
        params={"favorites_only": "true"},
    )
    assert [item["id"] for item in favorites.json()["documents"]] == [first_id]

    opened = client.get(
        f"/api/documents/{first_id}",
        headers=AUTH_HEADERS,
    )
    assert opened.status_code == 200
    assert opened.json()["summary"]["last_opened_at"] is not None

    duplicate = client.post(
        f"/api/documents/{first_id}/duplicate",
        headers=AUTH_HEADERS,
    )
    assert duplicate.status_code == 201
    assert duplicate.json()["summary"]["title"] == "收藏歌曲 副本"
    duplicate_id = duplicate.json()["summary"]["id"]

    deleted = client.delete(
        f"/api/documents/{duplicate_id}",
        headers=AUTH_HEADERS,
    )
    assert deleted.status_code == 204
    missing = client.get(
        f"/api/documents/{duplicate_id}",
        headers=AUTH_HEADERS,
    )
    assert missing.status_code == 404
