import {
  builder,
  type IpadicFeatures,
  type Tokenizer,
} from "kuromoji";
import BrowserDictionaryLoader from "kuromoji/src/loader/BrowserDictionaryLoader";

import { buildLineRomaji } from "@/lib/romaji";
import type {
  AnalysisWarning,
  LyricsDocument,
  LyricsLine,
  LyricsSegment,
} from "@/lib/types";

const KANJI_HELPERS = new Set(["々", "〆", "ヶ"]);
const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

const originalLoadArrayBuffer =
  BrowserDictionaryLoader.prototype.loadArrayBuffer;

BrowserDictionaryLoader.prototype.loadArrayBuffer = function (
  url,
  callback,
) {
  originalLoadArrayBuffer.call(this, url, (error, buffer) => {
    if (!error && buffer) {
      callback(null, buffer);
      return;
    }

    const plainDictionaryUrl = url.replace(/\.gz$/, "");
    void fetch(plainDictionaryUrl, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw error ?? new Error(
            `离线词典加载失败（HTTP ${response.status}）。`,
          );
        }
        return response.arrayBuffer();
      })
      .then((plainBuffer) => callback(null, plainBuffer))
      .catch((fallbackError: unknown) => {
        callback(
          fallbackError instanceof Error
            ? fallbackError
            : new Error("离线词典加载失败。"),
          null,
        );
      });
  });
};

function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function containsKanji(text: string): boolean {
  for (const character of text) {
    if (KANJI_HELPERS.has(character)) {
      return true;
    }
    const codepoint = character.codePointAt(0) ?? 0;
    if (
      (codepoint >= 0x3400 && codepoint <= 0x4dbf) ||
      (codepoint >= 0x4e00 && codepoint <= 0x9fff) ||
      (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
      (codepoint >= 0x20000 && codepoint <= 0x2fa1f)
    ) {
      return true;
    }
  }
  return false;
}

function katakanaToHiragana(text: string): string {
  return Array.from(text, (character) => {
    const codepoint = character.codePointAt(0) ?? 0;
    if (codepoint >= KATAKANA_START && codepoint <= KATAKANA_END) {
      return String.fromCodePoint(codepoint - 0x60);
    }
    return character;
  }).join("");
}

function normalizeReading(reading: string | undefined): string | null {
  const normalized = reading?.trim();
  if (!normalized || normalized === "*") {
    return null;
  }

  const hiragana = katakanaToHiragana(normalized);
  const hasHiragana = Array.from(hiragana).some((character) => {
    const codepoint = character.codePointAt(0) ?? 0;
    return codepoint >= HIRAGANA_START && codepoint <= HIRAGANA_END;
  });
  return hasHiragana ? hiragana : null;
}

function normalizeOptionalValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized !== "*" ? normalized : null;
}

export function loadOfflineTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      builder({ dicPath: "/kuromoji-dict" }).build((error, tokenizer) => {
        if (error) {
          reject(
            new Error("无法加载离线日语词典，请刷新页面后重试。"),
          );
          return;
        }
        resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

function buildFallbackSegment(
  surface: string,
  segmentIndex: number,
  lineIndex: number,
  documentId: string,
  note: string,
): LyricsSegment {
  return {
    id: `${documentId}-line-${lineIndex}-segment-${segmentIndex}`,
    segment_index: segmentIndex,
    surface,
    part_of_speech: null,
    part_of_speech_detail: [],
    dictionary_form: null,
    detected_reading: null,
    confirmed_reading: null,
    effective_reading: null,
    reading_source: "unavailable",
    reading_type: null,
    needs_review: true,
    is_oov: false,
    notes: [note],
  };
}

function buildSegment(
  token: IpadicFeatures,
  segmentIndex: number,
  lineIndex: number,
  documentId: string,
): { segment: LyricsSegment; warning: AnalysisWarning | null } {
  const surface = token.surface_form;
  const isOov = token.word_type === "UNKNOWN";
  const requiresReading = containsKanji(surface);
  const reading = requiresReading
    ? normalizeReading(token.reading)
    : null;

  let readingSource = "not-required";
  let needsReview = false;
  let notes: string[] = [];

  if (requiresReading && !reading) {
    readingSource = "unavailable";
    needsReview = true;
    notes = ["词典未提供可靠读音，请人工确认。"];
  } else if (requiresReading && isOov) {
    readingSource = "kuromoji-oov-estimate";
    needsReview = true;
    notes = ["词语未收录于词典，读音为自动估计，请人工确认。"];
  } else if (requiresReading) {
    readingSource = "kuromoji-dictionary";
  }

  const segment: LyricsSegment = {
    id: `${documentId}-line-${lineIndex}-segment-${segmentIndex}`,
    segment_index: segmentIndex,
    surface,
    part_of_speech: normalizeOptionalValue(token.pos),
    part_of_speech_detail: [
      token.pos,
      token.pos_detail_1,
      token.pos_detail_2,
      token.pos_detail_3,
      token.conjugated_type,
      token.conjugated_form,
    ],
    dictionary_form: normalizeOptionalValue(token.basic_form),
    detected_reading: reading,
    confirmed_reading: null,
    effective_reading: reading,
    reading_source: readingSource,
    reading_type: null,
    needs_review: needsReview,
    is_oov: isOov,
    notes,
  };

  const warning =
    needsReview && notes.length > 0
      ? {
          code: "reading_requires_review",
          message: notes[0],
          line_index: lineIndex,
          segment_index: segmentIndex,
        }
      : null;

  return { segment, warning };
}

export async function analyzeLyricsOffline(input: {
  text: string;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
}): Promise<LyricsDocument> {
  const tokenizer = await loadOfflineTokenizer();
  const documentId = createId("lyrics");
  const warnings: AnalysisWarning[] = [];
  const normalizedText = input.text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines: LyricsLine[] = normalizedText
    .split("\n")
    .map((lineText, lineIndex) => {
      const lineId = `${documentId}-line-${lineIndex}`;
      if (!lineText.trim()) {
        return {
          id: lineId,
          line_index: lineIndex,
          original_text: lineText,
          segments: [],
          romaji: "",
          is_blank: true,
        };
      }

      let tokens: IpadicFeatures[];
      try {
        tokens = tokenizer.tokenize(lineText);
      } catch {
        warnings.push({
          code: "line_analysis_failed",
          message: "该行分词失败，已保留原始文本，请人工确认。",
          line_index: lineIndex,
          segment_index: null,
        });
        return {
          id: lineId,
          line_index: lineIndex,
          original_text: lineText,
          segments: [
            buildFallbackSegment(
              lineText,
              0,
              lineIndex,
              documentId,
              "该行分词失败，已保留原文。",
            ),
          ],
          romaji: "",
          is_blank: false,
        };
      }

      const segments: LyricsSegment[] = [];
      tokens.forEach((token, segmentIndex) => {
        const { segment, warning } = buildSegment(
          token,
          segmentIndex,
          lineIndex,
          documentId,
        );
        segments.push(segment);
        if (warning) {
          warnings.push(warning);
        }
      });

      return {
        id: lineId,
        line_index: lineIndex,
        original_text: lineText,
        segments,
        romaji: buildLineRomaji(segments),
        is_blank: false,
      };
    });

  return {
    id: documentId,
    title: input.title?.trim() || null,
    artist: input.artist?.trim() || null,
    album: input.album?.trim() || null,
    source_url: null,
    original_text: input.text,
    lines,
    created_at: null,
    updated_at: null,
    warnings,
  };
}
