"""外部歌词搜索与获取接口。"""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.lyrics_source import (
    LyricsSearchResponse,
    LyricsSourceContent,
)
from app.services.lyrics_source import (
    LrclibLyricsSource,
    LyricsSourceNotFoundError,
    LyricsSourceUnavailableError,
)

router = APIRouter(prefix="/lyrics", tags=["lyrics-source"])
lyrics_source = LrclibLyricsSource()


@router.get(
    "/search",
    response_model=LyricsSearchResponse,
    summary="搜索可用歌词来源",
)
def search_lyrics(
    title: Annotated[
        str | None,
        Query(max_length=200, description="歌曲名称，可选"),
    ] = None,
    artist: Annotated[
        str | None,
        Query(max_length=200, description="歌手，可选"),
    ] = None,
) -> LyricsSearchResponse:
    """返回候选歌曲，不在此步骤获取完整歌词。"""
    normalized_title = (title or "").strip()
    normalized_artist = (artist or "").strip()
    if not normalized_title and not normalized_artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请至少填写歌名或歌手。",
        )

    query = " ".join(
        part for part in (normalized_title, normalized_artist) if part
    )
    try:
        results = lyrics_source.search(title=title, artist=artist)
    except LyricsSourceUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return LyricsSearchResponse(query=query, results=results)


@router.get(
    "/source",
    response_model=LyricsSourceContent,
    summary="获取选定来源的歌词",
)
def get_lyrics_source(
    source_id: Annotated[
        str,
        Query(pattern=r"^\d+$", description="歌词来源中的曲目 ID"),
    ],
    source: Annotated[
        Literal["lrclib"],
        Query(description="歌词来源名称"),
    ] = "lrclib",
) -> LyricsSourceContent:
    """只获取歌词正文，不执行分词或注音。"""
    del source
    try:
        return lyrics_source.get_lyrics(source_id)
    except LyricsSourceNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except LyricsSourceUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

