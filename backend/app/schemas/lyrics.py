"""歌词分析请求与响应模型。"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

MAX_LYRICS_LENGTH = 20_000


class LyricsAnalyzeRequest(BaseModel):
    """歌词分析请求。"""

    text: str = Field(
        min_length=1,
        max_length=MAX_LYRICS_LENGTH,
        description="包含换行的歌词原文",
    )
    title: str | None = Field(
        default=None,
        max_length=200,
        description="歌曲名称（可选）",
    )
    artist: str | None = Field(
        default=None,
        max_length=200,
        description="歌手（可选）",
    )

    @field_validator("text")
    @classmethod
    def validate_text_not_blank(cls, value: str) -> str:
        """拒绝只包含空白字符的歌词。"""
        if not value.strip():
            raise ValueError("歌词不能为空。")
        return value

    @field_validator("title", "artist")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        """把空白歌曲信息视为未填写。"""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AnalysisWarning(BaseModel):
    """无法完全确定分析结果时的提示。"""

    code: str
    message: str
    line_index: int | None = None
    segment_index: int | None = None


class LyricsSegment(BaseModel):
    """歌词分词片段。"""

    id: str
    segment_index: int
    surface: str
    part_of_speech: str | None
    part_of_speech_detail: list[str] = Field(default_factory=list)
    dictionary_form: str | None
    detected_reading: str | None
    confirmed_reading: str | None = None
    effective_reading: str | None
    reading_source: str | None
    reading_type: str | None = None
    needs_review: bool
    is_oov: bool
    notes: list[str] = Field(default_factory=list)


class LyricsLine(BaseModel):
    """保留原始行序的歌词行。"""

    id: str
    line_index: int
    original_text: str
    segments: list[LyricsSegment] = Field(default_factory=list)
    romaji: str = ""
    is_blank: bool


class LyricsDocument(BaseModel):
    """一次歌词分析的完整结果。"""

    id: str
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    source_url: str | None = None
    original_text: str
    lines: list[LyricsLine] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    warnings: list[AnalysisWarning] = Field(default_factory=list)
