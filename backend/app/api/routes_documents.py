"""共享歌词文档 API。"""

import sqlite3

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.security import require_access_token
from app.repositories.lyrics_repository import (
    DocumentNotFoundError,
    LyricsDocumentRepository,
)
from app.schemas.saved_documents import (
    SaveLyricsDocumentRequest,
    SavedDocumentDetail,
    SavedDocumentList,
    UpdateDocumentMetadataRequest,
)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    dependencies=[Depends(require_access_token)],
)
repository = LyricsDocumentRepository()


@router.get("", response_model=SavedDocumentList)
def list_documents(
    query: Annotated[str | None, Query(max_length=200)] = None,
    favorites_only: bool = False,
) -> SavedDocumentList:
    """列出共享库中保存的歌词文档。"""
    try:
        return SavedDocumentList(
            documents=repository.list(
                query=query,
                favorites_only=favorites_only,
            )
        )
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="读取共享歌词库失败。",
        ) from error


@router.post(
    "",
    response_model=SavedDocumentDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    payload: SaveLyricsDocumentRequest,
) -> SavedDocumentDetail:
    """保存一份新的歌词分析结果。"""
    try:
        return repository.save(payload.document)
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存共享歌词失败。",
        ) from error


@router.put("/{document_id}", response_model=SavedDocumentDetail)
def update_document(
    document_id: str,
    payload: SaveLyricsDocumentRequest,
) -> SavedDocumentDetail:
    """更新共享歌词和人工修正。"""
    try:
        return repository.save(payload.document, document_id)
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新共享歌词失败。",
        ) from error


@router.get("/{document_id}", response_model=SavedDocumentDetail)
def get_document(document_id: str) -> SavedDocumentDetail:
    """读取共享歌词、注音和人工修正。"""
    try:
        return repository.get(document_id, mark_opened=True)
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="读取共享歌词失败。",
        ) from error


@router.patch("/{document_id}", response_model=SavedDocumentDetail)
def update_document_metadata(
    document_id: str,
    payload: UpdateDocumentMetadataRequest,
) -> SavedDocumentDetail:
    """更新歌曲名称、歌手和收藏状态。"""
    try:
        return repository.update_metadata(
            document_id=document_id,
            title=payload.title.strip() if payload.title else None,
            artist=payload.artist.strip() if payload.artist else None,
            album=payload.album.strip() if payload.album else None,
            is_favorite=payload.is_favorite,
        )
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新歌词信息失败。",
        ) from error


@router.post(
    "/{document_id}/duplicate",
    response_model=SavedDocumentDetail,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_document(document_id: str) -> SavedDocumentDetail:
    """复制一份共享歌词文档。"""
    try:
        return repository.duplicate(document_id)
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="复制共享歌词失败。",
        ) from error


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(document_id: str) -> Response:
    """删除共享歌词文档及其修正。"""
    try:
        repository.delete(document_id)
    except DocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除共享歌词失败。",
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
