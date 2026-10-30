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

function getHttpErrorMessage(status: number): string {
  if (status === 404) {
    return "歌词来源中没有找到该曲目。";
  }
  if (status === 429) {
    return "歌词来源请求过于频繁，请稍后重试。";
  }
  if (status >= 500) {
    return "歌词来源暂时繁忙，请稍后重试。";
  }
  return `歌词来源请求失败（HTTP ${status}）。`;
}

function cleanSyncedLyrics(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(SYNC_TIMESTAMP_PATTERN, "").trimEnd())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
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
    return {
      query: "",
      results: [],
      manual_paste_fallback: true,
    };
  }

  const response = await fetch(
    `${LRCLIB_API}/search?${new URLSearchParams({ q: query })}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(getHttpErrorMessage(response.status));
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("歌词来源返回了无法识别的搜索结果。");
  }

  const candidates: Array<{
    score: number;
    index: number;
    result: LyricsSearchResult;
  }> = [];
  const seenIds = new Set<string>();

  payload.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }
    const record = item as Record<string, unknown>;
    const sourceId = String(record.id ?? "").trim();
    if (!sourceId || seenIds.has(sourceId)) {
      return;
    }

    const plain =
      typeof record.plainLyrics === "string" &&
      record.plainLyrics.trim().length > 0;
    const synced =
      typeof record.syncedLyrics === "string" &&
      record.syncedLyrics.trim().length > 0;
    if (record.instrumental === true || (!plain && !synced)) {
      return;
    }

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
      trackTitle.trim().toLocaleLowerCase() ===
        normalizedTitle.toLocaleLowerCase()
    ) {
      score += 100;
    }
    if (
      normalizedArtist &&
      trackArtist.trim().toLocaleLowerCase() ===
        normalizedArtist.toLocaleLowerCase()
    ) {
      score += 40;
    }
    const normalizedTrackTitle = trackTitle.toLocaleLowerCase();
    if (
      INSTRUMENTAL_MARKERS.some((marker) =>
        normalizedTrackTitle.includes(marker),
      )
    ) {
      score -= 80;
    }
    if (plain) {
      score += 10;
    }
    if (synced) {
      score += 5;
    }

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

export async function fetchLyricsSource(
  sourceId: string,
  signal?: AbortSignal,
): Promise<LyricsSourceContent> {
  if (!/^\d+$/.test(sourceId)) {
    throw new Error("无效的歌词来源 ID。");
  }

  const response = await fetch(`${LRCLIB_API}/get/${sourceId}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(getHttpErrorMessage(response.status));
  }

  const payload: unknown = await response.json();
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

  return {
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
