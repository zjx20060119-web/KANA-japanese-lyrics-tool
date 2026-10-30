"""歌词来源接口测试。"""

from fastapi.testclient import TestClient

from app.api import routes_lyrics_source
from app.main import app
from app.schemas.lyrics_source import (
    LyricsSearchResult,
    LyricsSourceContent,
)
from app.services.lyrics_source import (
    LyricsSourceNotFoundError,
    LyricsSourceUnavailableError,
)

client = TestClient(app)


def test_search_endpoint_returns_candidates(monkeypatch) -> None:
    monkeypatch.setattr(
        routes_lyrics_source.lyrics_source,
        "search",
        lambda title, artist=None: [
            LyricsSearchResult(
                source_id="101",
                title="夜に駆ける",
                artist="YOASOBI",
                album="夜に駆ける",
                duration_seconds=261,
                has_plain_lyrics=True,
                has_synced_lyrics=True,
            )
        ],
    )

    response = client.get(
        "/api/lyrics/search",
        params={"title": "夜に駆ける", "artist": "YOASOBI"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "夜に駆ける YOASOBI"
    assert payload["manual_paste_fallback"] is True
    assert payload["results"][0]["source_id"] == "101"


def test_search_endpoint_returns_empty_results(monkeypatch) -> None:
    monkeypatch.setattr(
        routes_lyrics_source.lyrics_source,
        "search",
        lambda title, artist=None: [],
    )

    response = client.get(
        "/api/lyrics/search",
        params={"title": "不存在的歌曲"},
    )

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_search_endpoint_accepts_artist_only(monkeypatch) -> None:
    captured: dict[str, str | None] = {}

    def search(title=None, artist=None):
        captured["title"] = title
        captured["artist"] = artist
        return [
            LyricsSearchResult(
                source_id="202",
                title="群青",
                artist="YOASOBI",
                album=None,
                duration_seconds=252,
                has_plain_lyrics=True,
                has_synced_lyrics=False,
            )
        ]

    monkeypatch.setattr(routes_lyrics_source.lyrics_source, "search", search)

    response = client.get(
        "/api/lyrics/search",
        params={"artist": "YOASOBI"},
    )

    assert response.status_code == 200
    assert response.json()["query"] == "YOASOBI"
    assert response.json()["results"][0]["artist"] == "YOASOBI"
    assert captured == {"title": None, "artist": "YOASOBI"}


def test_search_endpoint_requires_title_or_artist() -> None:
    response = client.get("/api/lyrics/search")

    assert response.status_code == 400
    assert "歌名或歌手" in response.json()["detail"]


def test_search_endpoint_reports_upstream_failure(monkeypatch) -> None:
    def unavailable(title: str, artist: str | None = None):
        raise LyricsSourceUnavailableError("歌词来源暂时繁忙。")

    monkeypatch.setattr(
        routes_lyrics_source.lyrics_source,
        "search",
        unavailable,
    )

    response = client.get(
        "/api/lyrics/search",
        params={"title": "夜に駆ける"},
    )

    assert response.status_code == 502
    assert "暂时繁忙" in response.json()["detail"]


def test_source_endpoint_returns_lyrics(monkeypatch) -> None:
    monkeypatch.setattr(
        routes_lyrics_source.lyrics_source,
        "get_lyrics",
        lambda source_id: LyricsSourceContent(
            source_id=source_id,
            title="曲名",
            artist="歌手",
            album=None,
            lyrics_text="一行目\n二行目",
            source_url="https://lrclib.net/",
            attribution="歌词数据由 LRCLIB 提供。",
        ),
    )

    response = client.get(
        "/api/lyrics/source",
        params={"source": "lrclib", "source_id": "101"},
    )

    assert response.status_code == 200
    assert response.json()["lyrics_text"] == "一行目\n二行目"


def test_source_endpoint_returns_404_for_missing_lyrics(monkeypatch) -> None:
    def not_found(source_id: str):
        raise LyricsSourceNotFoundError("没有可用歌词，请手动粘贴。")

    monkeypatch.setattr(
        routes_lyrics_source.lyrics_source,
        "get_lyrics",
        not_found,
    )

    response = client.get(
        "/api/lyrics/source",
        params={"source_id": "101"},
    )

    assert response.status_code == 404
    assert "手动粘贴" in response.json()["detail"]
