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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};
const MICROSOFT_TRANSLATE_URL =
  "https://edge.microsoft.com/translate/translatetext";
const MAX_TRANSLATION_LINES = 40;
const MAX_TRANSLATION_CHARACTERS = 8000;

function jsonResponse(payload, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge > 0
        ? `public, max-age=${maxAge}`
        : "no-store",
      ...CORS_HEADERS,
    },
  });
}

function cleanSyncedLyrics(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(SYNC_TIMESTAMP_PATTERN, "").trimEnd())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

function normalizeSearchItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const sourceId = String(item.id ?? "").trim();
  const title = item.trackName ?? item.name;
  const artist = item.artistName;
  const plain = typeof item.plainLyrics === "string" &&
    item.plainLyrics.trim().length > 0;
  const synced = typeof item.syncedLyrics === "string" &&
    item.syncedLyrics.trim().length > 0;

  if (
    !sourceId ||
    typeof title !== "string" ||
    typeof artist !== "string" ||
    item.instrumental === true ||
    (!plain && !synced)
  ) {
    return null;
  }

  return {
    source: "lrclib",
    source_id: sourceId,
    title,
    artist,
    album: typeof item.albumName === "string" ? item.albumName : null,
    duration_seconds:
      typeof item.duration === "number" ? item.duration : null,
    has_plain_lyrics: plain,
    has_synced_lyrics: synced,
  };
}

async function handleSearch(url) {
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) {
    return jsonResponse({ detail: "请至少填写歌名或歌手。" }, 400);
  }

  const upstream = await fetch(
    `${LRCLIB_API}/search?${new URLSearchParams({ q: query })}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "KANA-Lyrics-Proxy/1.0",
      },
    },
  );

  if (!upstream.ok) {
    return jsonResponse(
      {
        detail: upstream.status === 429
          ? "歌词来源请求过于频繁，请稍后再试。"
          : `歌词来源暂时不可用（HTTP ${upstream.status}）。`,
      },
      upstream.status === 429 ? 429 : 502,
    );
  }

  const payload = await upstream.json();
  if (!Array.isArray(payload)) {
    return jsonResponse(
      { detail: "歌词来源返回了无法识别的搜索结果。" },
      502,
    );
  }

  const seen = new Set();
  const results = [];
  const normalizedQuery = query.toLocaleLowerCase();

  for (const [index, item] of payload.entries()) {
    const result = normalizeSearchItem(item);
    if (!result || seen.has(result.source_id)) {
      continue;
    }
    seen.add(result.source_id);

    const title = result.title.trim().toLocaleLowerCase();
    const artist = result.artist.trim().toLocaleLowerCase();
    let score = 0;
    if (title === normalizedQuery) score += 100;
    if (artist === normalizedQuery) score += 40;
    if (INSTRUMENTAL_MARKERS.some((marker) => title.includes(marker))) {
      score -= 80;
    }
    if (result.has_plain_lyrics) score += 10;
    if (result.has_synced_lyrics) score += 5;

    results.push({ score, index, result });
  }

  results.sort((left, right) =>
    right.score - left.score || left.index - right.index
  );

  return jsonResponse(
    {
      query,
      results: results.slice(0, 10).map((item) => item.result),
      manual_paste_fallback: true,
    },
    200,
    600,
  );
}

async function handleSource(sourceId) {
  if (!/^\d+$/.test(sourceId)) {
    return jsonResponse({ detail: "无效的歌词来源 ID。" }, 400);
  }

  const upstream = await fetch(`${LRCLIB_API}/get/${sourceId}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "KANA-Lyrics-Proxy/1.0",
    },
  });

  if (!upstream.ok) {
    return jsonResponse(
      {
        detail: upstream.status === 404
          ? "歌词来源中没有找到该曲目。"
          : `歌词来源暂时不可用（HTTP ${upstream.status}）。`,
      },
      upstream.status === 404 ? 404 : 502,
    );
  }

  const payload = await upstream.json();
  if (!payload || typeof payload !== "object") {
    return jsonResponse({ detail: "歌词来源返回了无法识别的曲目数据。" }, 502);
  }

  const title = payload.trackName ?? payload.name;
  const artist = payload.artistName;
  const plain = typeof payload.plainLyrics === "string"
    ? payload.plainLyrics.trim()
    : "";
  const synced = typeof payload.syncedLyrics === "string"
    ? payload.syncedLyrics
    : "";
  const lyricsText = plain
    ? plain.replace(/^\n+|\n+$/g, "")
    : cleanSyncedLyrics(synced);

  if (
    typeof title !== "string" ||
    typeof artist !== "string" ||
    !lyricsText
  ) {
    return jsonResponse(
      { detail: "该来源没有提供可用歌词，请手动粘贴。" },
      404,
    );
  }

  return jsonResponse(
    {
      source: "lrclib",
      source_id: sourceId,
      title,
      artist,
      album: typeof payload.albumName === "string" ? payload.albumName : null,
      lyrics_text: lyricsText,
      source_url: LRCLIB_SOURCE_URL,
      attribution: LRCLIB_ATTRIBUTION,
      has_synced_lyrics: Boolean(synced.trim()),
    },
    200,
    3600,
  );
}

async function translateLines(texts) {
  const url = new URL(MICROSOFT_TRANSLATE_URL);
  url.searchParams.set("from", "ja");
  url.searchParams.set("to", "zh-Hans");
  url.searchParams.set("isEnterpriseClient", "false");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "KANA-Lyrics-Proxy/1.0",
    },
    body: JSON.stringify(texts),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Microsoft translation failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length !== texts.length) {
    throw new Error("Microsoft translation returned an invalid payload.");
  }

  return payload.map((item) => {
    const translations =
      item && typeof item === "object" ? item.translations : null;
    const text =
      Array.isArray(translations) &&
      translations[0] &&
      typeof translations[0] === "object"
        ? translations[0].text
        : "";
    return typeof text === "string" ? text.trim() : "";
  });
}

async function handleTranslate(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ detail: "翻译请求格式不正确。" }, 400);
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.texts)) {
    return jsonResponse({ detail: "翻译请求缺少 texts 数组。" }, 400);
  }

  const texts = payload.texts
    .slice(0, MAX_TRANSLATION_LINES)
    .map((text) => (typeof text === "string" ? text.trim() : ""));
  const totalCharacters = texts.reduce(
    (total, text) => total + text.length,
    0,
  );
  if (texts.length === 0 || totalCharacters === 0) {
    return jsonResponse({ detail: "没有可翻译的歌词。" }, 400);
  }
  if (totalCharacters > MAX_TRANSLATION_CHARACTERS) {
    return jsonResponse(
      { detail: "单次翻译内容过长，请分段后重试。" },
      413,
    );
  }

  const translated = await translateLines(texts);
  if (!translated.some(Boolean)) {
    return jsonResponse(
      { detail: "在线翻译暂时不可用，请稍后重试。" },
      502,
    );
  }

  return jsonResponse(
    {
      translations: translated,
      provider: "microsoft-edge",
    },
    200,
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    try {
      if (
        request.method === "POST" &&
        (url.pathname === "/translate" ||
          url.pathname === "/api/translate")
      ) {
        return await handleTranslate(request);
      }
      if (request.method !== "GET") {
        return jsonResponse({ detail: "该接口不支持此请求方法。" }, 405);
      }
      if (url.pathname === "/search" || url.pathname === "/api/search") {
        return await handleSearch(url);
      }
      const sourceMatch = url.pathname.match(
        /^\/(?:api\/)?source\/(\d+)$/,
      );
      if (sourceMatch) {
        return await handleSource(sourceMatch[1]);
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        return jsonResponse({ status: "ok", service: "kana-lyrics-proxy" });
      }
      return jsonResponse({ detail: "接口不存在。" }, 404);
    } catch {
      return jsonResponse(
        { detail: "云端歌词代理暂时无法连接歌词来源。" },
        502,
      );
    }
  },
};
