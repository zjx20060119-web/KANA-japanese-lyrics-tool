import type {
  AnalysisWarning,
  HealthResponse,
  LyricsDocument,
  LyricsLine,
  LyricsSearchResponse,
  LyricsSearchResult,
  LyricsSegment,
  LyricsSourceContent,
  SavedDocumentDetail,
  SavedDocumentList,
  SavedDocumentSummary,
} from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const CONFIGURED_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") || "";

export function getApiBaseUrl(): string {
  if (CONFIGURED_API_BASE_URL) {
    return CONFIGURED_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return DEFAULT_API_BASE_URL;
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === "ok" &&
    typeof candidate.service === "string" &&
    typeof candidate.version === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLyricsSegment(value: unknown): value is LyricsSegment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.segment_index === "number" &&
    typeof value.surface === "string" &&
    (typeof value.part_of_speech === "string" ||
      value.part_of_speech === null) &&
    Array.isArray(value.part_of_speech_detail) &&
    (typeof value.dictionary_form === "string" ||
      value.dictionary_form === null) &&
    (typeof value.detected_reading === "string" ||
      value.detected_reading === null) &&
    (typeof value.confirmed_reading === "string" ||
      value.confirmed_reading === null) &&
    (typeof value.effective_reading === "string" ||
      value.effective_reading === null) &&
    (typeof value.reading_source === "string" ||
      value.reading_source === null) &&
    typeof value.needs_review === "boolean" &&
    typeof value.is_oov === "boolean" &&
    Array.isArray(value.notes)
  );
}

function isLyricsLine(value: unknown): value is LyricsLine {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.line_index === "number" &&
    typeof value.original_text === "string" &&
    Array.isArray(value.segments) &&
    value.segments.every(isLyricsSegment) &&
    typeof value.romaji === "string" &&
    typeof value.is_blank === "boolean"
  );
}

function isAnalysisWarning(value: unknown): value is AnalysisWarning {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (typeof value.line_index === "number" || value.line_index === null) &&
    (typeof value.segment_index === "number" ||
      value.segment_index === null)
  );
}

function isLyricsDocument(value: unknown): value is LyricsDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (typeof value.title === "string" || value.title === null) &&
    (typeof value.artist === "string" || value.artist === null) &&
    (typeof value.album === "string" || value.album === null) &&
    typeof value.original_text === "string" &&
    Array.isArray(value.lines) &&
    value.lines.every(isLyricsLine) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isAnalysisWarning)
  );
}

function isLyricsSearchResult(value: unknown): value is LyricsSearchResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.source === "lrclib" &&
    typeof value.source_id === "string" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    (typeof value.album === "string" || value.album === null) &&
    (typeof value.duration_seconds === "number" ||
      value.duration_seconds === null) &&
    typeof value.has_plain_lyrics === "boolean" &&
    typeof value.has_synced_lyrics === "boolean"
  );
}

function isLyricsSearchResponse(
  value: unknown,
): value is LyricsSearchResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.query === "string" &&
    Array.isArray(value.results) &&
    value.results.every(isLyricsSearchResult) &&
    typeof value.manual_paste_fallback === "boolean"
  );
}

function isLyricsSourceContent(
  value: unknown,
): value is LyricsSourceContent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.source === "lrclib" &&
    typeof value.source_id === "string" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    (typeof value.album === "string" || value.album === null) &&
    typeof value.lyrics_text === "string" &&
    typeof value.source_url === "string" &&
    typeof value.attribution === "string" &&
    typeof value.has_synced_lyrics === "boolean"
  );
}

function isSavedDocumentSummary(
  value: unknown,
): value is SavedDocumentSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (typeof value.title === "string" || value.title === null) &&
    (typeof value.artist === "string" || value.artist === null) &&
    (typeof value.album === "string" || value.album === null) &&
    (typeof value.source_url === "string" || value.source_url === null) &&
    typeof value.preview === "string" &&
    typeof value.line_count === "number" &&
    typeof value.confirmed_count === "number" &&
    typeof value.revision === "number" &&
    typeof value.is_favorite === "boolean" &&
    (typeof value.last_opened_at === "string" ||
      value.last_opened_at === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isSavedDocumentDetail(
  value: unknown,
): value is SavedDocumentDetail {
  return (
    isRecord(value) &&
    isSavedDocumentSummary(value.summary) &&
    isLyricsDocument(value.document)
  );
}

function isSavedDocumentList(value: unknown): value is SavedDocumentList {
  return (
    isRecord(value) &&
    Array.isArray(value.documents) &&
    value.documents.every(isSavedDocumentSummary)
  );
}

async function getApiError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      if (typeof payload.detail === "string") {
        return payload.detail;
      }
      if (Array.isArray(payload.detail) && isRecord(payload.detail[0])) {
        const message = payload.detail[0].msg;
        if (typeof message === "string") {
          return message;
        }
      }
    }
  } catch {
    // Fall back to the status code when the body is not JSON.
  }

  return `请求失败（HTTP ${response.status}）。`;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/health`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`健康检查失败（HTTP ${response.status}）。`);
  }

  const payload: unknown = await response.json();
  if (!isHealthResponse(payload)) {
    throw new Error("健康检查返回的数据格式不符合约定。");
  }

  return payload;
}

type AnalyzeLyricsInput = {
  text: string;
  title?: string;
  artist?: string;
};

export async function analyzeLyrics(
  input: AnalyzeLyricsInput,
  signal?: AbortSignal,
): Promise<LyricsDocument> {
  const response = await fetch(`${getApiBaseUrl()}/api/lyrics/analyze`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text,
      title: input.title?.trim() || null,
      artist: input.artist?.trim() || null,
    }),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isLyricsDocument(payload)) {
    throw new Error("歌词分析接口返回的数据格式不符合约定。");
  }

  return payload;
}

export async function searchLyrics(
  title: string,
  artist: string,
  signal?: AbortSignal,
): Promise<LyricsSearchResponse> {
  const params = new URLSearchParams();
  if (title.trim()) {
    params.set("title", title.trim());
  }
  if (artist.trim()) {
    params.set("artist", artist.trim());
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/lyrics/search?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isLyricsSearchResponse(payload)) {
    throw new Error("歌词搜索接口返回的数据格式不符合约定。");
  }
  return payload;
}

export async function fetchLyricsSource(
  sourceId: string,
  signal?: AbortSignal,
): Promise<LyricsSourceContent> {
  const params = new URLSearchParams({
    source: "lrclib",
    source_id: sourceId,
  });
  const response = await fetch(
    `${getApiBaseUrl()}/api/lyrics/source?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isLyricsSourceContent(payload)) {
    throw new Error("歌词来源接口返回的数据格式不符合约定。");
  }
  return payload;
}

const LIBRARY_API_BASE_PATH = "/api/library";

type ListSavedDocumentsOptions = {
  query?: string;
  favoritesOnly?: boolean;
  signal?: AbortSignal;
};

export async function listSavedDocuments(
  options: ListSavedDocumentsOptions = {},
): Promise<SavedDocumentList> {
  const params = new URLSearchParams();
  if (options.query?.trim()) {
    params.set("query", options.query.trim());
  }
  if (options.favoritesOnly) {
    params.set("favorites_only", "true");
  }
  const queryString = params.toString();
  const response = await fetch(
    `${LIBRARY_API_BASE_PATH}${queryString ? `?${queryString}` : ""}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isSavedDocumentList(payload)) {
    throw new Error("共享歌词列表返回的数据格式不符合约定。");
  }
  return payload;
}

export async function getSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  const response = await fetch(
    `${LIBRARY_API_BASE_PATH}/${encodeURIComponent(documentId)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isSavedDocumentDetail(payload)) {
    throw new Error("共享歌词文档返回的数据格式不符合约定。");
  }
  return payload;
}

export async function saveLyricsDocument(
  document: LyricsDocument,
  documentId?: string | null,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  const response = await fetch(
    documentId
      ? `${LIBRARY_API_BASE_PATH}/${encodeURIComponent(documentId)}`
      : LIBRARY_API_BASE_PATH,
    {
      method: documentId ? "PUT" : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document }),
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isSavedDocumentDetail(payload)) {
    throw new Error("保存共享歌词返回的数据格式不符合约定。");
  }
  return payload;
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
  const response = await fetch(
    `${LIBRARY_API_BASE_PATH}/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        artist: input.artist,
        album: input.album,
        is_favorite: input.isFavorite,
      }),
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isSavedDocumentDetail(payload)) {
    throw new Error("更新歌词信息返回的数据格式不符合约定。");
  }
  return payload;
}

export async function duplicateSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<SavedDocumentDetail> {
  const response = await fetch(
    `${LIBRARY_API_BASE_PATH}/${encodeURIComponent(documentId)}/duplicate`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload: unknown = await response.json();
  if (!isSavedDocumentDetail(payload)) {
    throw new Error("复制歌词返回的数据格式不符合约定。");
  }
  return payload;
}

export async function deleteSavedDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${LIBRARY_API_BASE_PATH}/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(await getApiError(response));
  }
}
