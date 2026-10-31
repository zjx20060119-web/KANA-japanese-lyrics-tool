import { translateLinesOffline } from "@/lib/offlineTranslation";
import type { LyricsDocument, LyricsLine } from "@/lib/types";

const PROXY_BASE = (
  process.env.NEXT_PUBLIC_LYRICS_PROXY_URL ?? ""
).trim().replace(/\/+$/, "");
const TRANSLATION_TIMEOUT_MS = 30_000;
const MICROSOFT_TRANSLATE_ENDPOINT =
  "https://edge.microsoft.com/translate/translatetext";
const ONLINE_BATCH_SIZE = 40;
const ONLINE_BATCH_CHARACTERS = 8000;
const CACHE_PREFIX = "kana:microsoft-translation:v1:";

export type TranslationEngine =
  | "online"
  | "dictionary"
  | "mixed"
  | "cache";

export type TranslationResult = {
  engine: TranslationEngine;
  translations: Record<string, string>;
};

function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function cacheKey(text: string): string {
  return `${CACHE_PREFIX}${text.length}:${hashText(text)}`;
}

export function getCachedTranslation(text: string): string {
  if (typeof window === "undefined" || !text.trim()) {
    return "";
  }
  try {
    return window.localStorage.getItem(cacheKey(text)) ?? "";
  } catch {
    return "";
  }
}

export function saveTranslationCache(
  translations: Record<string, string>,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    for (const [text, translation] of Object.entries(translations)) {
      if (translation.trim()) {
        window.localStorage.setItem(cacheKey(text), translation);
      }
    }
  } catch {
    // Translation still works for the current session.
  }
}

function validateMicrosoftTranslations(
  payload: unknown,
  expectedLength: number,
): Record<number, string> {
  if (!Array.isArray(payload) || payload.length !== expectedLength) {
    throw new Error("微软翻译返回的条数不一致。");
  }

  const result: Record<number, string> = {};
  payload.forEach((item, index) => {
    const translations =
      typeof item === "object" && item !== null
        ? (item as { translations?: unknown }).translations
        : null;
    const text =
      Array.isArray(translations) &&
      typeof translations[0] === "object" &&
      translations[0] !== null
        ? (translations[0] as { text?: unknown }).text
        : null;
    if (typeof text === "string" && text.trim()) {
      result[index] = text.trim();
    }
  });
  if (Object.keys(result).length === 0) {
    throw new Error("微软翻译没有返回结果。");
  }
  return result;
}

async function translateMicrosoftBatch(
  lines: string[],
): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    TRANSLATION_TIMEOUT_MS,
  );

  try {
    const url = new URL(MICROSOFT_TRANSLATE_ENDPOINT);
    url.searchParams.set("from", "ja");
    url.searchParams.set("to", "zh-Hans");
    url.searchParams.set("isEnterpriseClient", "false");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lines),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`微软翻译请求失败（HTTP ${response.status}）。`);
    }

    const payload: unknown = await response.json();
    const translated = validateMicrosoftTranslations(payload, lines.length);
    const result: Record<string, string> = {};
    lines.forEach((line, index) => {
      const value = translated[index];
      if (value) {
        result[line] = value;
      }
    });
    return result;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function translateMicrosoftDirect(
  lines: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const batch of buildOnlineBatches(lines)) {
    Object.assign(result, await translateMicrosoftBatch(batch));
  }
  return result;
}

function buildOnlineBatches(lines: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let characters = 0;

  for (const line of lines) {
    if (
      batch.length > 0 &&
      (batch.length >= ONLINE_BATCH_SIZE ||
        characters + line.length > ONLINE_BATCH_CHARACTERS)
    ) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(line);
    characters += line.length;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}

async function translateThroughProxy(
  lines: string[],
): Promise<Record<string, string>> {
  if (!PROXY_BASE) {
    throw new Error("未配置云端翻译代理。");
  }

  const result: Record<string, string> = {};
  for (const batch of buildOnlineBatches(lines)) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      TRANSLATION_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${PROXY_BASE}/translate`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ texts: batch }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`云端翻译请求失败（HTTP ${response.status}）。`);
      }
      const payload: unknown = await response.json();
      const translated =
        typeof payload === "object" &&
        payload !== null &&
        Array.isArray((payload as Record<string, unknown>).translations)
          ? (payload as { translations: unknown[] }).translations
          : null;
      if (!translated || translated.length !== batch.length) {
        throw new Error("云端翻译返回格式不正确。");
      }
      batch.forEach((line, batchIndex) => {
        const value = translated[batchIndex];
        if (typeof value === "string" && value.trim()) {
          result[line] = value.trim();
        }
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  if (Object.keys(result).length === 0) {
    throw new Error("云端微软翻译没有返回结果。");
  }
  return result;
}

async function translateOnline(
  lines: string[],
): Promise<Record<string, string>> {
  try {
    return await translateMicrosoftDirect(lines);
  } catch (directError) {
    if (!PROXY_BASE) {
      throw directError;
    }
    return translateThroughProxy(lines);
  }
}

export async function translateDocumentHybrid(
  document: LyricsDocument,
): Promise<TranslationResult> {
  const translatableLines = document.lines.filter(
    (line) => !line.is_blank && line.original_text.trim(),
  );
  const translations: Record<string, string> = {};
  const missingLines: LyricsLine[] = [];
  let cachedCount = 0;

  for (const line of translatableLines) {
    const cached = getCachedTranslation(line.original_text);
    if (cached) {
      translations[line.original_text] = cached;
      cachedCount += 1;
    } else {
      missingLines.push(line);
    }
  }

  if (missingLines.length === 0) {
    return { engine: "cache", translations };
  }

  let onlineCount = 0;
  try {
    const online = await translateOnline(
      missingLines.map((line) => line.original_text),
    );
    for (const [text, translation] of Object.entries(online)) {
      translations[text] = translation;
      onlineCount += 1;
    }
  } catch {
    // Fall through to the offline dictionary.
  }

  const unresolvedLines = missingLines.filter(
    (line) => !translations[line.original_text],
  );
  let dictionaryCount = 0;
  if (unresolvedLines.length > 0) {
    try {
      const dictionary = await translateLinesOffline(unresolvedLines);
      dictionaryCount = Object.keys(dictionary).length;
      Object.assign(translations, dictionary);
    } catch (error) {
      if (onlineCount === 0 && cachedCount === 0) {
        throw error;
      }
    }
  }

  const hasAdditionalSources = cachedCount + dictionaryCount > 0;
  return {
    engine:
      onlineCount > 0 && !hasAdditionalSources
        ? "online"
        : onlineCount === 0 && cachedCount === 0
          ? "dictionary"
          : "mixed",
    translations,
  };
}
