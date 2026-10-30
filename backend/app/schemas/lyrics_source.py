"""外部歌词来源的请求与响应模型。"""

from typing import Literal

from pydantic import BaseModel, Field


class LyricsSearchResult(BaseModel):
    """可选择的歌词来源候选。"""

    source: Literal["lrclib"] = "lrclib"
    source_id: str
    title: str
    artist: str
    album: str | None = None
    duration_seconds: float | None = None
    has_plain_lyrics: bool
    has_synced_lyrics: bool


class LyricsSearchResponse(BaseModel):
    """歌词候选搜索结果。"""

    query: str
    results: list[LyricsSearchResult] = Field(default_factory=list)
    manual_paste_fallback: bool = True


class LyricsSourceContent(BaseModel):
    """从选定来源获取的歌词内容。"""

    source: Literal["lrclib"] = "lrclib"
    source_id: str
    title: str
    artist: str
    album: str | None = None
    lyrics_text: str
    source_url: str
    attribution: str
    has_synced_lyrics: bool = False

