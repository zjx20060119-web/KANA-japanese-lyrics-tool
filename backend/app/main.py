"""FastAPI 应用入口。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_documents import router as documents_router
from app.api.routes_health import router as health_router
from app.api.routes_lyrics import router as lyrics_router
from app.api.routes_lyrics_source import router as lyrics_source_router
from app.core.config import SERVICE_NAME, SERVICE_VERSION, get_cors_origins


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用。"""
    application = FastAPI(
        title="日语歌词智能注音 API",
        description="为日语歌词提供分词、读音候选和结构化注音数据。",
        version=SERVICE_VERSION,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    application.include_router(health_router, prefix="/api")
    application.include_router(lyrics_router, prefix="/api")
    application.include_router(lyrics_source_router, prefix="/api")
    application.include_router(documents_router, prefix="/api")

    @application.get("/", include_in_schema=False)
    def service_index() -> dict[str, str]:
        return {
            "service": SERVICE_NAME,
            "docs": "/docs",
            "health": "/api/health",
            "analyze": "/api/lyrics/analyze",
        }

    return application


app = create_app()

