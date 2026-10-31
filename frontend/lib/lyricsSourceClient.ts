import type {
  LyricsSearchResponse,
  LyricsSearchResult,
  LyricsSourceContent,
} from "@/lib/types";

const LRCLIB_API = "https://lrclib.net/api";
const LRCLIB_SOURCE_URL = "https://lrclib.net/";
const LRCLIB_ATTRIBUTION =
  "歌词数据由 LRCLIB 提供。请遵守来源网站条款和歌曲版权要求。";
const SYNC_TIMESTAMP_PATTERN = /^(?:\[[^\]]+\])+\s*/;
const INSTRUMENTAL_MARKERS = [
  "(inst)",
  "instrumental",
  "off vocal",
  "カラオケ",
  "karaoke",
];
const REQUEST_TIMEOUT_MS = 18_000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SOURCE_CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_PREFIX = "kana:lyrics-cache:v1:";
const PROXY_BASE = (
  process.env.NEXT_PUBLIC_LYRICS_PROXY_URL ?? ""
).trim().replace(/\/+$/, "");

type CachedPayload<T> = {
  expiresAt: number;
  value: T;
};

export function isLyricsProxyEnabled(): boolean {
  return Boolean(PROXY_BASE);
}

function getHttpErrorMessage(status: number): string {
  if (status === 404) return "歌词来源中没有找到该曲目。";
  if (status === 429) return "歌词来源请求过于频繁，请稍后重试。";
  if (status >= 500) return "歌词来源暂时繁忙，请稍后重试。";
  return `歌词来源请求失败（HTTP ${status}）。`;
}

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, value }),
    );
  } catch {
    // Search still works when session storage is unavailable.
  }
}

async function fetchWithTimeout(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  let timedOut = false;
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(
        "搜索超时。请检查网络后重试，或先在下方手动粘贴歌词。",
      );
    }
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (error instanceof TypeError) {
      throw new Error("无法连接歌词来源，请检查网络后重试。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function fetchPreferredSource(
  proxyUrl: string | null,
  directUrl: string,
  signal?: AbortSignal,
): Promise<{ response: Response; viaProxy: boolean }> {
  if (proxyUrl) {
    try {
      const proxyResponse = await fetchWithTimeout(proxyUrl, signal);
      if (proxyResponse.ok) {
        return { response: proxyResponse, viaProxy: true };
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
    }
  }

  return {
    response: await fetchWithTimeout(directUrl, signal),
    viaProxy: false,
  };
}

function cleanSyncedLyrics(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(SYNC_TIMESTAMP_PATTERN, "").trimEnd())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

function isSearchResult(value: unknown): value is LyricsSearchResult {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item.source === "lrclib" &&
    typeof item.source_id === "string" &&
    typeof item.title === "string" &&
    typeof item.artist === "string" &&
    (typeof item.album === "string" || item.album === null) &&
    (typeof item.duration_seconds === "number" ||
      item.duration_seconds === null) &&
    typeof item.has_plain_lyrics === "boolean" &&
    typeof item.has_synced_lyrics === "boolean"
  );
}

function isSearchResponse(value: unknown): value is LyricsSearchResponse {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.query === "string" &&
    Array.isArray(payload.results) &&
    payload.results.every(isSearchResult) &&
    payload.manual_paste_fallback === true
  );
}

function isSourceContent(value: unknown): value is LyricsSourceContent {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item.source === "lrclib" &&
    typeof item.source_id === "string" &&
    typeof item.title === "string" &&
    typeof item.artist === "string" &&
    (typeof item.album === "string" || item.album === null) &&
    typeof item.lyrics_text === "string" &&
    typeof item.source_url === "string" &&
    typeof item.attribution === "string" &&
    typeof item.has_synced_lyrics === "boolean"
  );
}

function normalizeDirectSearch(
  payload: unknown,
  query: string,
  title: string,
  artist: string,
): LyricsSearchResponse {
  if (!Array.isArray(payload)) {
    throw new Error("歌词来源返回了无法识别的搜索结果。");
  }

  const normalizedTitle = title.trim().toLocaleLowerCase();
  const normalizedArtist = artist.trim().toLocaleLowerCase();
  const candidates: Array<{
    score: number;
    index: number;
    result: LyricsSearchResult;
  }> = [];
  const seenIds = new Set<string>();

  payload.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const record = item as Record<string, unknown>;
    const sourceId = String(record.id ?? "").trim();
    if (!sourceId || seenIds.has(sourceId)) return;

    const plain =
      typeof record.plainLyrics === "string" &&
      record.plainLyrics.trim().length > 0;
    const synced =
      typeof record.syncedLyrics === "string" &&
      record.syncedLyrics.trim().length > 0;
    if (record.instrumental === true || (!plain && !synced)) return;

    const trackTitle = record.trackName ?? record.name;
    const trackArtist = record.artistName;
    if (typeof trackTitle !== "string" || typeof trackArtist !== "string") {
      return;
    }

    const result: LyricsSearchResult = {
      source: "lrclib",
      source_id: sourceId,
      title: trackTitle,
      artist: trackArtist,
      album:
        typeof record.albumName === "string" ? record.albumName : null,
      duration_seconds:
        typeof record.duration === "number" ? record.duration : null,
      has_plain_lyrics: plain,
      has_synced_lyrics: synced,
    };

    let score = 0;
    if (
      normalizedTitle &&
      trackTitle.trim().toLocaleLowerCase() === normalizedTitle
    ) score += 100;
    if (
      normalizedArtist &&
      trackArtist.trim().toLocaleLowerCase() === normalizedArtist
    ) score += 40;
    if (
      INSTRUMENTAL_MARKERS.some((marker) =>
        trackTitle.toLocaleLowerCase().includes(marker),
      )
    ) score -= 80;
    if (plain) score += 10;
    if (synced) score += 5;

    seenIds.add(sourceId);
    candidates.push({ score, index, result });
  });

  candidates.sort(
    (left, right) =>
      right.score - left.score || left.index - right.index,
  );

  return {
    query,
    results: candidates.slice(0, 10).map((item) => item.result),
    manual_paste_fallback: true,
  };
}

export async function searchLyrics(
  title: string,
  artist: string,
  signal?: AbortSignal,
): Promise<LyricsSearchResponse> {
  const normalizedTitle = title.trim();
  const normalizedArtist = artist.trim();
  const query = [normalizedTitle, normalizedArtist]
    .filter(Boolean)
    .join(" ");

  if (!query) {
    return { query: "", results: [], manual_paste_fallback: true };
  }

  const cacheKey = `search:${query.toLocaleLowerCase()}`;
  const cached = readCache<LyricsSearchResponse>(cacheKey);
  if (cached) return cached;

  const { response, viaProxy } = await fetchPreferredSource(
    PROXY_BASE
      ? `${PROXY_BASE}/search?${new URLSearchParams({ q: query })}`
      : null,
    `${LRCLIB_API}/search?${new URLSearchParams({ q: query })}`,
    signal,
  );

  if (!response.ok) {
    throw new Error(getHttpErrorMessage(response.status));
  }

  const payload: unknown = await response.json();
  const normalized = viaProxy
    ? isSearchResponse(payload)
      ? payload
      : null
    : normalizeDirectSearch(payload, query, normalizedTitle, normalizedArtist);

  if (!normalized) {
    throw new Error("歌词来源返回了无法识别的搜索结果。");
  }

  writeCache(cacheKey, normalized, SEARCH_CACHE_TTL_MS);
  return normalized;
}

export async function fetchLyricsSource(
  sourceId: string,
  signal?: AbortSignal,
): Promise<LyricsSourceContent> {
  if (!/^\d+$/.test(sourceId)) {
    throw new Error("无效的歌词来源 ID。");
  }

  const cacheKey = `source:${sourceId}`;
  const cached = readCache<LyricsSourceContent>(cacheKey);
  if (cached) return cached;

  const { response, viaProxy } = await fetchPreferredSource(
    PROXY_BASE ? `${PROXY_BASE}/source/${sourceId}` : null,
    `${LRCLIB_API}/get/${sourceId}`,
    signal,
  );

  if (!response.ok) {
    throw new Error(getHttpErrorMessage(response.status));
  }

  const payload: unknown = await response.json();
  let content: LyricsSourceContent;

  if (viaProxy) {
    if (!isSourceContent(payload)) {
      throw new Error("云端歌词代理返回的数据格式不正确。");
    }
    content = payload;
  } else {
    if (typeof payload !== "object" || payload === null) {
      throw new Error("歌词来源返回了无法识别的曲目数据。");
    }
    const record = payload as Record<string, unknown>;
    if (record.instrumental === true) {
      throw new Error("该曲目被标记为纯音乐，没有可注音歌词。");
    }

    const plain =
      typeof record.plainLyrics === "string"
        ? record.plainLyrics.trim()
        : "";
    const synced =
      typeof record.syncedLyrics === "string"
        ? record.syncedLyrics
        : "";
    const lyricsText = plain
      ? plain.replace(/^\n+|\n+$/g, "")
      : cleanSyncedLyrics(synced);
    if (!lyricsText) {
      throw new Error("该来源没有提供可用歌词，请手动粘贴。");
    }

    const trackTitle = record.trackName ?? record.name;
    const trackArtist = record.artistName;
    if (typeof trackTitle !== "string" || typeof trackArtist !== "string") {
      throw new Error("歌词来源缺少曲目名称或歌手信息。");
    }

    content = {
      source: "lrclib",
      source_id: sourceId,
      title: trackTitle,
      artist: trackArtist,
      album:
        typeof record.albumName === "string" ? record.albumName : null,
      lyrics_text: lyricsText,
      source_url: LRCLIB_SOURCE_URL,
      attribution: LRCLIB_ATTRIBUTION,
      has_synced_lyrics: Boolean(synced.trim()),
    };
  }

  writeCache(cacheKey, content, SOURCE_CACHE_TTL_MS);
  return content;
}
