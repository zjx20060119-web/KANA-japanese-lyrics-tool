"""SQLite 歌词文档与人工修正存储。"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.core.config import get_database_path
from app.schemas.lyrics import LyricsDocument
from app.schemas.saved_documents import (
    SavedDocumentDetail,
    SavedDocumentSummary,
)
from app.services.romaji import build_line_romaji

SCHEMA = """
CREATE TABLE IF NOT EXISTS lyrics_documents (
    id TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    album TEXT,
    source_url TEXT,
    original_text TEXT NOT NULL,
    preview TEXT NOT NULL,
    line_count INTEGER NOT NULL,
    analysis_json TEXT NOT NULL,
    revision INTEGER NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    last_opened_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lyrics_corrections (
    document_id TEXT NOT NULL,
    line_index INTEGER NOT NULL,
    segment_index INTEGER NOT NULL,
    surface TEXT NOT NULL,
    confirmed_reading TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (document_id, line_index, segment_index, surface),
    FOREIGN KEY (document_id)
        REFERENCES lyrics_documents(id)
        ON DELETE CASCADE
);
"""


class DocumentNotFoundError(RuntimeError):
    """指定歌词文档不存在。"""


class LyricsDocumentRepository:
    """使用独立 SQLite 连接提供共享歌词文档。"""

    def __init__(self, database_path: str | None = None) -> None:
        self.database_path = database_path or get_database_path()
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(SCHEMA)
            columns = {
                row["name"]
                for row in connection.execute(
                    "PRAGMA table_info(lyrics_documents)"
                ).fetchall()
            }
            if "is_favorite" not in columns:
                connection.execute(
                    "ALTER TABLE lyrics_documents "
                    "ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0"
                )
            if "last_opened_at" not in columns:
                connection.execute(
                    "ALTER TABLE lyrics_documents ADD COLUMN last_opened_at TEXT"
                )
            if "album" not in columns:
                connection.execute(
                    "ALTER TABLE lyrics_documents ADD COLUMN album TEXT"
                )

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _first_line_preview(text: str) -> str:
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:
                return stripped[:120]
        return ""

    @staticmethod
    def _extract_corrections(
        document: LyricsDocument,
    ) -> list[tuple[int, int, str, str]]:
        corrections: list[tuple[int, int, str, str]] = []
        for line in document.lines:
            for segment in line.segments:
                reading = (
                    segment.confirmed_reading.strip()
                    if segment.confirmed_reading
                    else ""
                )
                if reading:
                    corrections.append(
                        (
                            line.line_index,
                            segment.segment_index,
                            segment.surface,
                            reading,
                        )
                    )
        return corrections

    @staticmethod
    def _apply_corrections(
        document: LyricsDocument,
        corrections: dict[tuple[int, int, str], str],
    ) -> LyricsDocument:
        if not corrections:
            return document

        updated_lines = []
        for line in document.lines:
            segments = []
            for segment in line.segments:
                reading = corrections.get(
                    (
                        line.line_index,
                        segment.segment_index,
                        segment.surface,
                    )
                )
                confirmed = reading or segment.confirmed_reading
                segments.append(
                    segment.model_copy(
                        update={
                            "confirmed_reading": confirmed,
                            "effective_reading": confirmed
                            or segment.detected_reading,
                            "needs_review": False
                            if confirmed
                            else segment.needs_review,
                        }
                    )
                )
            updated_lines.append(
                line.model_copy(
                    update={
                        "segments": segments,
                        "romaji": build_line_romaji(segments),
                    }
                )
            )
        return document.model_copy(update={"lines": updated_lines})

    def _summary_from_row(
        self,
        row: sqlite3.Row,
        confirmed_count: int,
    ) -> SavedDocumentSummary:
        return SavedDocumentSummary(
            id=row["id"],
            title=row["title"],
            artist=row["artist"],
            album=row["album"],
            source_url=row["source_url"],
            preview=row["preview"],
            line_count=row["line_count"],
            confirmed_count=confirmed_count,
            revision=row["revision"],
            is_favorite=bool(row["is_favorite"]),
            last_opened_at=datetime.fromisoformat(row["last_opened_at"])
            if row["last_opened_at"]
            else None,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def save(
        self,
        document: LyricsDocument,
        document_id: str | None = None,
    ) -> SavedDocumentDetail:
        now = self._now()
        target_id = document_id or f"doc-{uuid4()}"
        corrections = self._extract_corrections(document)
        prepared = document.model_copy(deep=True)
        prepared.id = target_id
        prepared.created_at = now
        prepared.updated_at = now

        with self._connect() as connection:
            existing = None
            if document_id:
                existing = connection.execute(
                    "SELECT created_at, revision FROM lyrics_documents WHERE id = ?",
                    (target_id,),
                ).fetchone()
                if existing is None:
                    raise DocumentNotFoundError("共享歌词文档不存在。")

            created_at = (
                datetime.fromisoformat(existing["created_at"])
                if existing
                else now
            )
            revision = int(existing["revision"]) + 1 if existing else 1
            prepared.created_at = created_at
            prepared.updated_at = now

            connection.execute(
                """
                INSERT INTO lyrics_documents (
                    id, title, artist, album, source_url, original_text, preview,
                    line_count, analysis_json, revision, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    artist = excluded.artist,
                    album = excluded.album,
                    source_url = excluded.source_url,
                    original_text = excluded.original_text,
                    preview = excluded.preview,
                    line_count = excluded.line_count,
                    analysis_json = excluded.analysis_json,
                    revision = excluded.revision,
                    updated_at = excluded.updated_at
                """,
                (
                    target_id,
                    prepared.title,
                    prepared.artist,
                    prepared.album,
                    prepared.source_url,
                    prepared.original_text,
                    self._first_line_preview(prepared.original_text),
                    sum(1 for line in prepared.lines if not line.is_blank),
                    prepared.model_dump_json(),
                    revision,
                    created_at.isoformat(),
                    now.isoformat(),
                ),
            )
            connection.execute(
                "DELETE FROM lyrics_corrections WHERE document_id = ?",
                (target_id,),
            )
            connection.executemany(
                """
                INSERT INTO lyrics_corrections (
                    document_id, line_index, segment_index, surface,
                    confirmed_reading, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (target_id, *correction, now.isoformat())
                    for correction in corrections
                ],
            )

        return self.get(target_id)

    def list(
        self,
        query: str | None = None,
        favorites_only: bool = False,
    ) -> list[SavedDocumentSummary]:
        conditions: list[str] = []
        parameters: list[object] = []
        if favorites_only:
            conditions.append("d.is_favorite = 1")
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            conditions.append(
                "(d.title LIKE ? OR d.artist LIKE ? OR d.original_text LIKE ?)"
            )
            parameters.extend([pattern, pattern, pattern])
        where_clause = (
            f"WHERE {' AND '.join(conditions)}" if conditions else ""
        )

        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT d.*,
                    (
                        SELECT COUNT(*)
                        FROM lyrics_corrections c
                        WHERE c.document_id = d.id
                    ) AS confirmed_count
                FROM lyrics_documents d
                {where_clause}
                ORDER BY COALESCE(d.last_opened_at, d.updated_at) DESC
                """,
                parameters,
            ).fetchall()
        return [
            self._summary_from_row(row, int(row["confirmed_count"]))
            for row in rows
        ]

    def get(
        self,
        document_id: str,
        mark_opened: bool = False,
    ) -> SavedDocumentDetail:
        with self._connect() as connection:
            if mark_opened:
                connection.execute(
                    """
                    UPDATE lyrics_documents
                    SET last_opened_at = ?
                    WHERE id = ?
                    """,
                    (self._now().isoformat(), document_id),
                )
            row = connection.execute(
                """
                SELECT d.*,
                    (
                        SELECT COUNT(*)
                        FROM lyrics_corrections c
                        WHERE c.document_id = d.id
                    ) AS confirmed_count
                FROM lyrics_documents d
                WHERE d.id = ?
                """,
                (document_id,),
            ).fetchone()
            if row is None:
                raise DocumentNotFoundError("共享歌词文档不存在。")

            correction_rows = connection.execute(
                """
                SELECT line_index, segment_index, surface, confirmed_reading
                FROM lyrics_corrections
                WHERE document_id = ?
                """,
                (document_id,),
            ).fetchall()

        document = LyricsDocument.model_validate_json(row["analysis_json"])
        corrections = {
            (
                int(correction["line_index"]),
                int(correction["segment_index"]),
                str(correction["surface"]),
            ): str(correction["confirmed_reading"])
            for correction in correction_rows
        }
        document = self._apply_corrections(document, corrections)
        document.id = row["id"]
        document.created_at = datetime.fromisoformat(row["created_at"])
        document.updated_at = datetime.fromisoformat(row["updated_at"])

        return SavedDocumentDetail(
            summary=self._summary_from_row(
                row,
                int(row["confirmed_count"]),
            ),
            document=document,
        )

    def update_metadata(
        self,
        document_id: str,
        title: str | None,
        artist: str | None,
        album: str | None,
        is_favorite: bool,
    ) -> SavedDocumentDetail:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT analysis_json FROM lyrics_documents WHERE id = ?",
                (document_id,),
            ).fetchone()
            if row is None:
                raise DocumentNotFoundError("共享歌词文档不存在。")

            document = LyricsDocument.model_validate_json(
                row["analysis_json"]
            )
            document.title = title
            document.artist = artist
            document.album = album
            now = self._now().isoformat()
            connection.execute(
                """
                UPDATE lyrics_documents
                SET title = ?, artist = ?, album = ?, analysis_json = ?,
                    is_favorite = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    title,
                    artist,
                    album,
                    document.model_dump_json(),
                    int(is_favorite),
                    now,
                    document_id,
                ),
            )
        return self.get(document_id)

    def duplicate(self, document_id: str) -> SavedDocumentDetail:
        original = self.get(document_id)
        duplicate = original.document.model_copy(deep=True)
        base_title = duplicate.title or "未命名歌曲"
        duplicate.title = f"{base_title} 副本"
        return self.save(duplicate)

    def delete(self, document_id: str) -> None:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM lyrics_documents WHERE id = ?",
                (document_id,),
            )
            if cursor.rowcount == 0:
                raise DocumentNotFoundError("共享歌词文档不存在。")
