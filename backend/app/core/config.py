"""后端运行配置。

首阶段不引入额外配置框架，保持依赖精简。需要允许其他开发地址访问时，
可通过 CORS_ORIGINS 环境变量传入逗号分隔的完整 Origin。
"""

import os
from pathlib import Path

SERVICE_NAME = "japanese-lyrics-api"
SERVICE_VERSION = "0.1.0"
DEFAULT_DATABASE_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "lyrics.db"
)

DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
)


def get_cors_origins() -> list[str]:
    """读取并规范化允许跨域访问的前端地址。"""
    configured_origins = os.getenv("CORS_ORIGINS", "")
    origins = [
        origin.strip().rstrip("/")
        for origin in configured_origins.split(",")
        if origin.strip()
    ]
    return origins or list(DEFAULT_CORS_ORIGINS)


def get_database_path() -> str:
    """返回共享 SQLite 数据库路径。"""
    return os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH))


def get_app_access_token() -> str:
    """读取个人访问口令；未配置时禁止访问共享数据。"""
    return os.getenv("APP_ACCESS_TOKEN", "").strip()
