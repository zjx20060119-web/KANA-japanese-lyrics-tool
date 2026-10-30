"""系统健康检查接口。"""

from fastapi import APIRouter

from app.core.config import SERVICE_NAME, SERVICE_VERSION
from app.schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="检查后端服务状态",
)
def health_check() -> HealthResponse:
    """返回后端服务的可用状态和版本信息。"""
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
    )

