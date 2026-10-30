import Dexie, { type Table } from "dexie";

import type {
  LyricsDocument,
  SavedDocumentDetail,
  SavedDocumentList,
  SavedDocumentSummary,
} from "@/lib/types";

type LocalDocumentRecord = {
  id: string;
  document: LyricsDocument;
  revision: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
};

type MetaRecord = {
  key: string;
  value: string;
};

type ListOptions = {
  query?: string;
  favoritesOnly?: boolean;
  signal?: AbortSignal;
};

class KanaLibraryDatabase extends Dexie {
  documents!: Table<LocalDocumentRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("kana-offline-library");
    this.version(1).stores({
      documents:
        "id, updatedAt, createdAt, lastOpenedAt, isFavorite",
      meta: "key",
    });
  }
}

const SEED_KEY = "initial-library-v1";
let database: KanaLibraryDatabase | null = null;

function getDatabase(): KanaLibraryDatabase {
  if (typeof window === "undefined") {
    throw new Error("本地歌词库只能在浏览器中使用。");
  }
  if (!database) {
    database = new KanaLibraryDatabase();
  }
  return database;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function ensureInitialLibrary(
  db: KanaLibraryDatabase,
): Promise<void> {
  const seeded = await db.meta.get(SEED_KEY);
  if (seeded) {
    return;
  }

  try {
    const response = await fetch("/initial-library.json", {
      cache: "no-store",
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (Array.isArray(payload)) {
        const records = payload.filter(
          (item): item is LocalDocumentRecord =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as LocalDocumentRecord).id === "string" &&
            typeof (item as LocalDocumentRecord).document === "object",
        );
        if (records.length > 0) {
          await db.documents.bulkPut(records);
        }
      }
    }
  } catch {
    // A fresh checkout has no personal seed file; start empty.
  }

  await db.meta.put({ key: SEED_KEY, value: "done" });
}

function getPreview(document: LyricsDocument): string {
  for (const line of document.lines) {
    if (line.original_text.trim()) {
      return line.original_text.trim().slice(0, 120);
    }
  }
  return "";
}

function buildSummary(
  record: LocalDocumentRecord,
): SavedDocumentSummary {
  const document = record.document;
  const confirmedCount = document.lines.reduce(
    (count, line) =>
      count +
      line.segments.filter((segment) => segment.confirmed_reading).length,
    0,
  );

  return {
    id: record.id,
    title: document.title,
    artist: document.artist,
    album: document.album,
    source_url: document.source_url,
    preview: getPreview(document),
    line_count: document.lines.filter((line) => !line.is_blank).length,
    confirmed_count: confirmedCount,
    revision: record.revision,
    is_favorite: record.isFavorite,
    last_opened_at: record.lastOpenedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function cloneDocument(document: LyricsDocument): LyricsDocument {
  return JSON.parse(JSON.stringify(document)) as LyricsDocument;
}

function createDocumentId(): string {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `doc-${random}`;
}

function matchesQuery(
  record: LocalDocumentRecord,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const document = record.document;
  return [
    document.title,
    document.artist,
    document.album,
    document.original_text,
  ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
}

export async function listSavedDocuments(
  options: ListOptions = {},
): Promise<SavedDocumentList> {
  throwIfAborted(options.signal);
  const db = getDatabase();
  await ensureInitialLibrary(db);
  throwIfAborted(options.signal);

  const records = (await db.documents.toArray())
    .filter(
      (record) =>
        (!options.favoritesOnly || record.isFavorite) &&
        matchesQuery(record, options.query ?? ""),
    )
    .sort((left, right) => {
      const leftDate = left.lastOpenedAt ?? left.updatedAt;
      const rightDate = right.lastOpenedAt ?? right.updatedAt;
      return Date.parse(rightDate) - Date.parse(leftDate);
    });

  return {
    documents: records.map(buildSummary),
  };
}

export async function getSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  throwIfAborted(signal);
  const db = getDatabase();
  await ensureInitialLibrary(db);
  const record = await db.documents.get(documentId);
  if (!record) {
    throw new Error("本地歌词文档不存在。");
  }

  const lastOpenedAt = new Date().toISOString();
  const updatedRecord = { ...record, lastOpenedAt };
  await db.documents.update(documentId, { lastOpenedAt });
  throwIfAborted(signal);

  return {
    summary: buildSummary(updatedRecord),
    document: updatedRecord.document,
  };
}

export async function saveLyricsDocument(
  document: LyricsDocument,
  documentId?: string | null,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  throwIfAborted(signal);
  const db = getDatabase();
  await ensureInitialLibrary(db);

  const existing = documentId
    ? await db.documents.get(documentId)
    : undefined;
  if (documentId && !existing) {
    throw new Error("本地歌词文档不存在。");
  }

  const now = new Date().toISOString();
  const targetId = documentId ?? createDocumentId();
  const prepared = cloneDocument(document);
  prepared.id = targetId;
  prepared.created_at = existing?.createdAt ?? now;
  prepared.updated_at = now;

  const record: LocalDocumentRecord = {
    id: targetId,
    document: prepared,
    revision: existing ? existing.revision + 1 : 1,
    isFavorite: existing?.isFavorite ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: existing?.lastOpenedAt ?? null,
  };

  await db.documents.put(record);
  throwIfAborted(signal);
  return {
    summary: buildSummary(record),
    document: prepared,
  };
}

export async function updateSavedDocumentMetadata(
  documentId: string,
  input: {
    title: string | null;
    artist: string | null;
    album: string | null;
    isFavorite: boolean;
  },
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  throwIfAborted(signal);
  const db = getDatabase();
  await ensureInitialLibrary(db);
  const existing = await db.documents.get(documentId);
  if (!existing) {
    throw new Error("本地歌词文档不存在。");
  }

  const now = new Date().toISOString();
  const document = {
    ...existing.document,
    title: input.title,
    artist: input.artist,
    album: input.album,
    updated_at: now,
  };
  const record: LocalDocumentRecord = {
    ...existing,
    document,
    isFavorite: input.isFavorite,
    updatedAt: now,
  };
  await db.documents.put(record);
  throwIfAborted(signal);
  return {
    summary: buildSummary(record),
    document,
  };
}

export async function duplicateSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  const original = await getSavedDocument(documentId, signal);
  const duplicate = cloneDocument(original.document);
  duplicate.title = `${duplicate.title || "未命名歌曲"} 副本`;
  return saveLyricsDocument(duplicate, null, signal);
}

export async function deleteSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const db = getDatabase();
  await ensureInitialLibrary(db);
  const existing = await db.documents.get(documentId);
  if (!existing) {
    throw new Error("本地歌词文档不存在。");
  }
  await db.documents.delete(documentId);
  throwIfAborted(signal);
}
