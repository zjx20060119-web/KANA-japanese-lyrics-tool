"""外部歌词来源适配器测试。"""

from urllib.parse import parse_qs, urlparse

import pytest

from app.services.lyrics_source import (
    LrclibLyricsSource,
    LyricsSourceNotFoundError,
    LyricsSourceUnavailableError,
)


def test_search_parses_candidates_and_skips_unusable_items() -> None:
    requested_urls: list[str] = []
    payload = [
        {
            "id": 101,
            "trackName": "夜に駆ける",
            "artistName": "YOASOBI",
            "albumName": "夜に駆ける",
            "duration": 261,
            "instrumental": False,
            "plainLyrics": "歌詞",
            "syncedLyrics": None,
        },
        {
            "id": 102,
            "trackName": "纯音乐",
            "artistName": "Artist",
            "instrumental": True,
            "plainLyrics": "不应出现",
        },
        {
            "id": 103,
            "trackName": "没有歌词",
            "artistName": "Artist",
            "plainLyrics": "",
        },
    ]

    def fetch(url: str, timeout: float) -> object:
        requested_urls.append(url)
        return payload

    source = LrclibLyricsSource(json_fetcher=fetch)
    results = source.search("夜に駆ける", "YOASOBI")

    assert len(results) == 1
    assert results[0].source_id == "101"
    assert results[0].title == "夜に駆ける"
    assert results[0].artist == "YOASOBI"
    assert results[0].has_plain_lyrics is True
    assert results[0].has_synced_lyrics is False
    query = parse_qs(urlparse(requested_urls[0]).query)["q"][0]
    assert query == "夜に駆ける YOASOBI"


def test_get_lyrics_prefers_plain_text() -> None:
    source = LrclibLyricsSource(
        json_fetcher=lambda url, timeout: {
            "id": 101,
            "trackName": "曲名",
            "artistName": "歌手",
            "albumName": "专辑",
            "plainLyrics": "一行目\n二行目\n",
            "syncedLyrics": "[00:01.00] 一行目",
        }
    )

    content = source.get_lyrics("101")

    assert content.lyrics_text == "一行目\n二行目"
    assert content.title == "曲名"
    assert content.artist == "歌手"
    assert content.has_synced_lyrics is True
    assert "LRCLIB" in content.attribution


def test_search_accepts_artist_only() -> None:
    requested_urls: list[str] = []

    def fetch(url: str, timeout: float) -> object:
        requested_urls.append(url)
        return [
            {
                "id": 202,
                "trackName": "群青",
                "artistName": "YOASOBI",
                "plainLyrics": "歌詞",
            }
        ]

    source = LrclibLyricsSource(json_fetcher=fetch)
    results = source.search(artist="YOASOBI")

    assert results[0].title == "群青"
    query = parse_qs(urlparse(requested_urls[0]).query)["q"][0]
    assert query == "YOASOBI"


def test_get_lyrics_falls_back_to_synced_text() -> None:
    source = LrclibLyricsSource(
        json_fetcher=lambda url, timeout: {
            "id": 101,
            "trackName": "曲名",
            "artistName": "歌手",
            "plainLyrics": None,
            "syncedLyrics": "[00:01.00] 一行目\n[00:02.00]\n[00:03.00] 三行目",
        }
    )

    content = source.get_lyrics("101")

    assert content.lyrics_text == "一行目\n\n三行目"


def test_source_errors_are_mapped() -> None:
    def unavailable(url: str, timeout: float) -> object:
        raise LyricsSourceUnavailableError("来源繁忙")

    with pytest.raises(LyricsSourceUnavailableError):
        LrclibLyricsSource(json_fetcher=unavailable).search("曲名")

    with pytest.raises(LyricsSourceNotFoundError):
        LrclibLyricsSource().get_lyrics("not-an-id")


def test_exact_title_is_ranked_before_instrumental_variant() -> None:
    source = LrclibLyricsSource(
        json_fetcher=lambda url, timeout: [
            {
                "id": 1,
                "trackName": "夜に駆ける(inst)",
                "artistName": "YOASOBI",
                "instrumental": False,
                "plainLyrics": "歌词",
            },
            {
                "id": 2,
                "trackName": "夜に駆ける",
                "artistName": "YOASOBI",
                "instrumental": False,
                "plainLyrics": "歌词",
            },
        ]
    )

    results = source.search("夜に駆ける", "YOASOBI")

    assert [result.source_id for result in results] == ["2", "1"]

