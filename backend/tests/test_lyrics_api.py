"""歌词分析接口集成测试。"""

from fastapi.testclient import TestClient

from app.api import routes_lyrics
from app.main import app
from app.services.analyzer import AnalyzerUnavailableError

client = TestClient(app)


def test_analyze_endpoint_returns_structured_lines() -> None:
    response = client.post(
        "/api/lyrics/analyze",
        json={
            "text": "夜に駆ける\n\n沈むように",
            "title": "テスト曲",
            "artist": "テスト歌手",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"].startswith("lyrics-")
    assert payload["title"] == "テスト曲"
    assert payload["artist"] == "テスト歌手"
    assert payload["original_text"] == "夜に駆ける\n\n沈むように"
    assert len(payload["lines"]) == 3
    assert payload["lines"][1]["is_blank"] is True
    assert payload["lines"][0]["romaji"] == "yoru ni kakeru"
    assert payload["lines"][0]["segments"][0] == {
        "id": payload["lines"][0]["segments"][0]["id"],
        "segment_index": 0,
        "surface": "夜",
        "part_of_speech": "名詞",
        "part_of_speech_detail": [
            "名詞",
            "普通名詞",
            "副詞可能",
            "*",
            "*",
            "*",
        ],
        "dictionary_form": "夜",
        "detected_reading": "よる",
        "confirmed_reading": None,
        "effective_reading": "よる",
        "reading_source": "sudachi-dictionary",
        "reading_type": None,
        "needs_review": False,
        "is_oov": False,
        "notes": [],
    }


def test_analyze_endpoint_rejects_whitespace_only_input() -> None:
    response = client.post(
        "/api/lyrics/analyze",
        json={"text": "  \n\t  "},
    )

    assert response.status_code == 422
    assert "歌词不能为空" in response.text


def test_analyze_endpoint_requires_text() -> None:
    response = client.post("/api/lyrics/analyze", json={})

    assert response.status_code == 422


def test_analyze_endpoint_reports_unavailable_analyzer(
    monkeypatch,
) -> None:
    def raise_unavailable(
        self,
        text: str,
        title: str | None = None,
        artist: str | None = None,
    ):
        raise AnalyzerUnavailableError("dictionary missing")

    monkeypatch.setattr(
        routes_lyrics.analyzer,
        "analyze",
        raise_unavailable.__get__(routes_lyrics.analyzer),
    )

    response = client.post(
        "/api/lyrics/analyze",
        json={"text": "夜に駆ける"},
    )

    assert response.status_code == 503
    assert "日语分析器暂时不可用" in response.json()["detail"]
