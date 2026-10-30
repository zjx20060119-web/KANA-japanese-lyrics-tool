"""歌词分析 HTTP 接口。"""

import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.lyrics import LyricsAnalyzeRequest, LyricsDocument
from app.services.analyzer import AnalyzerUnavailableError, LyricsAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lyrics", tags=["lyrics"])
analyzer = LyricsAnalyzer()


@router.post(
    "/analyze",
    response_model=LyricsDocument,
    summary="分析日语歌词分词与读音",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "歌词为空或超过长度限制"
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "SudachiPy 或词典不可用"
        },
    },
)
def analyze_lyrics(payload: LyricsAnalyzeRequest) -> LyricsDocument:
    """保留歌词行结构，返回分词、词性和自动读音。"""
    try:
        return analyzer.analyze(
            text=payload.text,
            title=payload.title,
            artist=payload.artist,
        )
    except AnalyzerUnavailableError as error:
        logger.exception("Sudachi analyzer is unavailable")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="日语分析器暂时不可用，请检查 SudachiPy 和词典依赖。",
        ) from error
