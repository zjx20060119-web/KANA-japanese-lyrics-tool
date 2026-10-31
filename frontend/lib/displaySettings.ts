export type DisplaySettings = {
  lyricSize: number;
  romajiSize: number;
  rowGap: number;
  romajiGap: number;
  translationGap: number;
  showRomaji: boolean;
  showTranslation: boolean;
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  lyricSize: 25,
  romajiSize: 13,
  rowGap: 20,
  romajiGap: -8,
  translationGap: 4,
  showRomaji: true,
  showTranslation: true,
};

const STORAGE_KEY = "kana:reader-spacing:v1";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeDisplaySettings(
  settings: Partial<DisplaySettings>,
): DisplaySettings {
  return {
    lyricSize: clamp(
      Number(settings.lyricSize ?? DEFAULT_DISPLAY_SETTINGS.lyricSize),
      16,
      36,
    ),
    romajiSize: clamp(
      Number(settings.romajiSize ?? DEFAULT_DISPLAY_SETTINGS.romajiSize),
      10,
      20,
    ),
    rowGap: clamp(
      Number(settings.rowGap ?? DEFAULT_DISPLAY_SETTINGS.rowGap),
      0,
      48,
    ),
    romajiGap: clamp(
      Number(settings.romajiGap ?? DEFAULT_DISPLAY_SETTINGS.romajiGap),
      -8,
      24,
    ),
    translationGap: clamp(
      Number(
        settings.translationGap ??
          DEFAULT_DISPLAY_SETTINGS.translationGap,
      ),
      -8,
      32,
    ),
    showRomaji:
      typeof settings.showRomaji === "boolean"
        ? settings.showRomaji
        : DEFAULT_DISPLAY_SETTINGS.showRomaji,
    showTranslation:
      typeof settings.showTranslation === "boolean"
        ? settings.showTranslation
        : DEFAULT_DISPLAY_SETTINGS.showTranslation,
  };
}

export function loadDisplaySettings(): DisplaySettings {
  if (typeof window === "undefined") {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_DISPLAY_SETTINGS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_DISPLAY_SETTINGS;
    }
    return normalizeDisplaySettings(parsed as Partial<DisplaySettings>);
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for the current session.
  }
}

export function resetDisplaySettings(): DisplaySettings {
  const settings = { ...DEFAULT_DISPLAY_SETTINGS };
  saveDisplaySettings(settings);
  return settings;
}
