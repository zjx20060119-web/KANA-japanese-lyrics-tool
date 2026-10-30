"""个人访问口令校验。"""

import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_app_access_token


def require_access_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """校验 Bearer 个人访问口令。"""
    configured_token = get_app_access_token()
    if not configured_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="共享数据访问口令尚未配置。",
        )

    scheme, _, supplied_token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not supplied_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要个人访问口令。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not secrets.compare_digest(supplied_token, configured_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="访问口令不正确。",
            headers={"WWW-Authenticate": "Bearer"},
        )
