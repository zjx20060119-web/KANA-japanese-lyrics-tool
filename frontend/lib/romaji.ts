import type { LyricsSegment } from "@/lib/types";

const SINGLE_KANA: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "i",
  ゑ: "e",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ゔ: "vu",
};

const COMBINATION_KANA: Record<string, string> = {
  きゃ: "kya",
  きゅ: "kyu",
  きょ: "kyo",
  しゃ: "sha",
  しゅ: "shu",
  しょ: "sho",
  しぇ: "she",
  ちゃ: "cha",
  ちゅ: "chu",
  ちょ: "cho",
  ちぇ: "che",
  にゃ: "nya",
  にゅ: "nyu",
  にょ: "nyo",
  ひゃ: "hya",
  ひゅ: "hyu",
  ひょ: "hyo",
  みゃ: "mya",
  みゅ: "myu",
  みょ: "myo",
  りゃ: "rya",
  りゅ: "ryu",
  りょ: "ryo",
  ぎゃ: "gya",
  ぎゅ: "gyu",
  ぎょ: "gyo",
  じゃ: "ja",
  じゅ: "ju",
  じょ: "jo",
  じぇ: "je",
  びゃ: "bya",
  びゅ: "byu",
  びょ: "byo",
  ぴゃ: "pya",
  ぴゅ: "pyu",
  ぴょ: "pyo",
  ふぁ: "fa",
  ふぃ: "fi",
  ふぇ: "fe",
  ふぉ: "fo",
  ふゅ: "fyu",
  てぃ: "ti",
  でぃ: "di",
  とぅ: "tu",
  どぅ: "du",
  うぃ: "wi",
  うぇ: "we",
  うぉ: "wo",
  ゔぁ: "va",
  ゔぃ: "vi",
  ゔぇ: "ve",
  ゔぉ: "vo",
};

const PUNCTUATION_MAP: Record<string, string> = {
  "。": ".",
  "、": ",",
  "！": "!",
  "？": "?",
  "「": '"',
  "」": '"',
  "『": '"',
  "』": '"',
  "（": "(",
  "）": ")",
  "［": "[",
  "］": "]",
  "・": "·",
  "〜": "~",
  "～": "~",
  "…": "...",
};

const PARTICLE_READINGS: Record<string, string> = {
  は: "wa",
  へ: "e",
  を: "o",
};

const SPACE_BEFORE_PUNCTUATION = /\s+([,.;:!?)\]"])/g;
const SPACE_AFTER_OPENING = /([(\["])\s+/g;
const MULTIPLE_SPACES = /\s+/g;

export function getEffectiveReading(
  segment: LyricsSegment,
): string | null {
  const confirmed = segment.confirmed_reading?.trim();
  if (confirmed) {
    return confirmed;
  }

  return segment.detected_reading?.trim() || null;
}

function katakanaToHiragana(text: string): string {
  return Array.from(text, (character) => {
    const codepoint = character.codePointAt(0) ?? 0;
    if (codepoint >= 0x30a1 && codepoint <= 0x30f6) {
      return String.fromCodePoint(codepoint - 0x60);
    }
    return character;
  }).join("");
}

function lastVowel(text: string): string {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if ("aeiou".includes(text[index])) {
      return text[index];
    }
  }
  return "";
}

export function romanizeKana(text: string): string {
  const characters = Array.from(katakanaToHiragana(text));
  const output: string[] = [];
  let index = 0;
  let doubleNextConsonant = false;

  while (index < characters.length) {
    const character = characters[index];

    if (character === "っ") {
      doubleNextConsonant = true;
      index += 1;
      continue;
    }

    if (character === "ー") {
      const vowel = lastVowel(output.join(""));
      if (vowel) {
        output.push(vowel);
      }
      index += 1;
      continue;
    }

    if (character === "ん") {
      const nextCharacter = characters[index + 1] ?? "";
      output.push(
        nextCharacter && "あいうえおやゆよ".includes(nextCharacter)
          ? "n'"
          : "n",
      );
      index += 1;
      continue;
    }

    const pair = characters.slice(index, index + 2).join("");
    let syllable: string;
    if (pair in COMBINATION_KANA) {
      syllable = COMBINATION_KANA[pair];
      index += 2;
    } else {
      syllable =
        SINGLE_KANA[character] ?? PUNCTUATION_MAP[character] ?? character;
      index += 1;
    }

    if (doubleNextConsonant) {
      if (syllable.startsWith("ch")) {
        output.push("t");
      } else if (syllable && !"aeiou".includes(syllable[0])) {
        output.push(syllable[0]);
      }
      doubleNextConsonant = false;
    }

    output.push(syllable);
  }

  return output.join("");
}

export function romanizeSegment(segment: LyricsSegment): string {
  if (!segment.surface.trim()) {
    return "";
  }

  if (
    segment.part_of_speech === "助詞" &&
    segment.surface in PARTICLE_READINGS
  ) {
    return PARTICLE_READINGS[segment.surface];
  }

  return romanizeKana(getEffectiveReading(segment) ?? segment.surface);
}

export function buildLineRomaji(segments: LyricsSegment[]): string {
  const parts = segments
    .filter((segment) => segment.surface.trim())
    .map((segment) => romanizeSegment(segment).trim());

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(MULTIPLE_SPACES, " ")
    .trim()
    .replace(SPACE_BEFORE_PUNCTUATION, "$1")
    .replace(SPACE_AFTER_OPENING, "$1");
}
