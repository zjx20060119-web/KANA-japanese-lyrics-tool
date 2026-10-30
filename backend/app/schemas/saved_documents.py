"""共享歌词文档的保存与读取模型。"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.lyrics import LyricsDocument


class SaveLyricsDocumentRequest(BaseModel):
    """保存当前完整的歌词分析结果。"""

    document: LyricsDocument


class SavedDocumentSummary(BaseModel):
    """共享库中的歌词文档摘要。"""

    id: str
    title: str | None
    artist: str | None
    album: str | None
    source_url: str | None
    preview: str
    line_count: int
    confirmed_count: int
    revision: int
    is_favorite: bool
    last_opened_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SavedDocumentDetail(BaseModel):
    """共享库中的完整歌词文档。"""

    summary: SavedDocumentSummary
    document: LyricsDocument


class SavedDocumentList(BaseModel):
    """共享歌词文档列表。"""

    documents: list[SavedDocumentSummary] = Field(default_factory=list)


class UpdateDocumentMetadataRequest(BaseModel):
    """更新歌词库中的歌曲信息与收藏状态。"""

    title: str | None = None
    artist: str | None = None
    album: str | None = None
    is_favorite: bool
