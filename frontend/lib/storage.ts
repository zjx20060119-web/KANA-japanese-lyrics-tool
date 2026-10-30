import type { ReadingOverrides } from "@/lib/readingOverrides";

const STORAGE_PREFIX = "kana:reading-overrides:v1:";

function hashLyrics(text: string): string {
  let hash = 0x811c9dc5;

  for (const character of text.replace(/\r\n?/g, "\n")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getLyricsStorageKey(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  return `${STORAGE_PREFIX}${normalized.length}:${hashLyrics(normalized)}`;
}

function isReadingOverrides(value: unknown): value is ReadingOverrides {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value).every(
    (reading) => typeof reading === "string",
  );
}

export function loadReadingOverrides(text: string): ReadingOverrides {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(getLyricsStorageKey(text));
    if (!stored) {
      return {};
    }

    const parsed: unknown = JSON.parse(stored);
    return isReadingOverrides(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveReadingOverrides(
  text: string,
  overrides: ReadingOverrides,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getLyricsStorageKey(text);
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(overrides));
  } catch {
    // The analysis flow still works when browser storage is unavailable.
  }
}

export function clearReadingOverrides(text: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getLyricsStorageKey(text));
  } catch {
    // Ignore storage failures; current page state can still be cleared.
  }
}
