"""独立于注音引擎的歌词来源适配层。"""

import json
import re
import socket
import time
from collections.abc import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.schemas.lyrics_source import (
    LyricsSearchResult,
    LyricsSourceContent,
)

DEFAULT_LRCLIB_API_BASE_URL = "https://lrclib.net/api"
LRCLIB_SOURCE_URL = "https://lrclib.net/"
LRCLIB_ATTRIBUTION = (
    "歌词数据由 LRCLIB 提供。请遵守来源网站条款和歌曲版权要求。"
)
LRCLIB_USER_AGENT = "KANA-Lyrics-Tool/0.1 (personal study)"
SYNC_TIMESTAMP_PATTERN = re.compile(r"^(?:\[[^\]]+\])+\s*")
INSTRUMENTAL_MARKERS = (
    "(inst)",
    "instrumental",
    "off vocal",
    "カラオケ",
    "karaoke",
)


class LyricsSourceError(RuntimeError):
    """歌词来源错误基类。"""


class LyricsSourceUnavailableError(LyricsSourceError):
    """歌词来源暂时不可用。"""


class LyricsSourceNotFoundError(LyricsSourceError):
    """歌词来源中不存在指定曲目或歌词。"""


JsonFetcher = Callable[[str, float], object]


def _default_json_fetcher(url: str, timeout: float) -> object:
    for attempt in range(3):
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": LRCLIB_USER_AGENT,
            },
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code in {502, 503, 504} and attempt < 2:
                time.sleep(0.5 * (attempt + 1))
                continue
            if error.code == 404:
                raise LyricsSourceNotFoundError(
                    "歌词来源中没有找到该曲目。"
                ) from error
            if error.code == 429:
                raise LyricsSourceUnavailableError(
                    "歌词来源请求过于频繁，请稍后重试。"
                ) from error
            raise LyricsSourceUnavailableError(
                f"歌词来源暂时不可用（HTTP {error.code}）。"
            ) from error
        except (URLError, TimeoutError, socket.timeout) as error:
            raise LyricsSourceUnavailableError(
                "无法连接歌词来源，请检查网络后重试。"
            ) from error
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise LyricsSourceUnavailableError(
                "歌词来源返回了无法解析的数据。"
            ) from error

    raise LyricsSourceUnavailableError("歌词来源暂时不可用。")


def _clean_synced_lyrics(synced_lyrics: str) -> str:
    lines = [
        SYNC_TIMESTAMP_PATTERN.sub("", line).rstrip()
        for line in synced_lyrics.splitlines()
    ]
    return "\n".join(lines).strip("\n")


class LrclibLyricsSource:
    """LRCLIB 公开歌词 API 的轻量适配器。"""

    source_name = "lrclib"

    def __init__(
        self,
        base_url: str = DEFAULT_LRCLIB_API_BASE_URL,
        timeout: float = 12.0,
        json_fetcher: JsonFetcher | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._json_fetcher = json_fetcher or _default_json_fetcher

    def search(
        self,
        title: str | None = None,
        artist: str | None = None,
        limit: int = 10,
    ) -> list[LyricsSearchResult]:
        """按歌名或歌手检索歌词候选。"""
        normalized_title = (title or "").strip()
        normalized_artist = artist.strip() if artist else ""
        query = " ".join(
            part for part in (normalized_title, normalized_artist) if part
        )
        if not query:
            return []

        url = f"{self.base_url}/search?{urlencode({'q': query})}"
        payload = self._json_fetcher(url, self.timeout)
        if not isinstance(payload, list):
            raise LyricsSourceUnavailableError(
                "歌词来源返回了无法识别的搜索结果。"
            )

        candidates: list[tuple[int, int, LyricsSearchResult]] = []
        seen_ids: set[str] = set()
        for item_index, item in enumerate(payload):
            if not isinstance(item, dict):
                continue

            source_id = str(item.get("id", "")).strip()
            if not source_id or source_id in seen_ids:
                continue

            plain_lyrics = item.get("plainLyrics")
            synced_lyrics = item.get("syncedLyrics")
            has_plain = isinstance(plain_lyrics, str) and bool(
                plain_lyrics.strip()
            )
            has_synced = isinstance(synced_lyrics, str) and bool(
                synced_lyrics.strip()
            )
            if item.get("instrumental") is True or not (
                has_plain or has_synced
            ):
                continue

            title_value = item.get("trackName") or item.get("name")
            artist_value = item.get("artistName")
            if not isinstance(title_value, str) or not isinstance(
                artist_value, str
            ):
                continue

            duration = item.get("duration")
            result = LyricsSearchResult(
                source_id=source_id,
                title=title_value,
                artist=artist_value,
                album=item.get("albumName")
                if isinstance(item.get("albumName"), str)
                else None,
                duration_seconds=float(duration)
                if isinstance(duration, (int, float))
                else None,
                has_plain_lyrics=has_plain,
                has_synced_lyrics=has_synced,
            )
            normalized_result_title = title_value.strip().casefold()
            normalized_result_artist = artist_value.strip().casefold()
            score = 0
            if normalized_result_title == normalized_title.casefold():
                score += 100
            if (
                normalized_artist
                and normalized_result_artist == normalized_artist.casefold()
            ):
                score += 40
            if any(
                marker in normalized_result_title
                for marker in INSTRUMENTAL_MARKERS
            ):
                score -= 80
            if has_plain:
                score += 10
            if has_synced:
                score += 5

            candidates.append((score, item_index, result))
            seen_ids.add(source_id)

        candidates.sort(key=lambda candidate: (-candidate[0], candidate[1]))
        return [
            result
            for _, _, result in candidates[: max(0, limit)]
        ]

    def get_lyrics(self, source_id: str) -> LyricsSourceContent:
        """获取某个 LRCLIB 候选的可用歌词正文。"""
        if not source_id.isdigit():
            raise LyricsSourceNotFoundError("无效的歌词来源 ID。")

        payload = self._json_fetcher(
            f"{self.base_url}/get/{source_id}",
            self.timeout,
        )
        if not isinstance(payload, dict):
            raise LyricsSourceUnavailableError(
                "歌词来源返回了无法识别的曲目数据。"
            )
        if payload.get("instrumental") is True:
            raise LyricsSourceNotFoundError(
                "该曲目被标记为纯音乐，没有可注音歌词。"
            )

        plain_lyrics = payload.get("plainLyrics")
        synced_lyrics = payload.get("syncedLyrics")
        lyrics_text = ""
        if isinstance(plain_lyrics, str) and plain_lyrics.strip():
            lyrics_text = plain_lyrics.strip("\n")
        elif isinstance(synced_lyrics, str) and synced_lyrics.strip():
            lyrics_text = _clean_synced_lyrics(synced_lyrics)

        if not lyrics_text:
            raise LyricsSourceNotFoundError(
                "该来源没有提供可用歌词，请手动粘贴。"
            )

        title = payload.get("trackName") or payload.get("name")
        artist = payload.get("artistName")
        if not isinstance(title, str) or not isinstance(artist, str):
            raise LyricsSourceUnavailableError(
                "歌词来源缺少曲目名称或歌手信息。"
            )

        return LyricsSourceContent(
            source_id=source_id,
            title=title,
            artist=artist,
            album=payload.get("albumName")
            if isinstance(payload.get("albumName"), str)
            else None,
            lyrics_text=lyrics_text,
            source_url=LRCLIB_SOURCE_URL,
            attribution=LRCLIB_ATTRIBUTION,
            has_synced_lyrics=bool(
                isinstance(synced_lyrics, str) and synced_lyrics.strip()
            ),
        )

