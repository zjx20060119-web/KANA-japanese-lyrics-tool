"""健康检查响应模型。"""

from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """后端服务健康状态。"""

    status: Literal["ok"] = "ok"
    service: str
    version: str

