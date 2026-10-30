"""假名到罗马音的转换。"""

import re

from app.schemas.lyrics import LyricsSegment
from app.services.reading_service import katakana_to_hiragana

SINGLE_KANA = {
    "あ": "a",
    "い": "i",
    "う": "u",
    "え": "e",
    "お": "o",
    "ぁ": "a",
    "ぃ": "i",
    "ぅ": "u",
    "ぇ": "e",
    "ぉ": "o",
    "か": "ka",
    "き": "ki",
    "く": "ku",
    "け": "ke",
    "こ": "ko",
    "さ": "sa",
    "し": "shi",
    "す": "su",
    "せ": "se",
    "そ": "so",
    "た": "ta",
    "ち": "chi",
    "つ": "tsu",
    "て": "te",
    "と": "to",
    "な": "na",
    "に": "ni",
    "ぬ": "nu",
    "ね": "ne",
    "の": "no",
    "は": "ha",
    "ひ": "hi",
    "ふ": "fu",
    "へ": "he",
    "ほ": "ho",
    "ま": "ma",
    "み": "mi",
    "む": "mu",
    "め": "me",
    "も": "mo",
    "や": "ya",
    "ゆ": "yu",
    "よ": "yo",
    "ゃ": "ya",
    "ゅ": "yu",
    "ょ": "yo",
    "ら": "ra",
    "り": "ri",
    "る": "ru",
    "れ": "re",
    "ろ": "ro",
    "わ": "wa",
    "ゐ": "i",
    "ゑ": "e",
    "を": "o",
    "ん": "n",
    "が": "ga",
    "ぎ": "gi",
    "ぐ": "gu",
    "げ": "ge",
    "ご": "go",
    "ざ": "za",
    "じ": "ji",
    "ず": "zu",
    "ぜ": "ze",
    "ぞ": "zo",
    "だ": "da",
    "ぢ": "ji",
    "づ": "zu",
    "で": "de",
    "ど": "do",
    "ば": "ba",
    "び": "bi",
    "ぶ": "bu",
    "べ": "be",
    "ぼ": "bo",
    "ぱ": "pa",
    "ぴ": "pi",
    "ぷ": "pu",
    "ぺ": "pe",
    "ぽ": "po",
    "ゔ": "vu",
}

COMBINATION_KANA = {
    "きゃ": "kya",
    "きゅ": "kyu",
    "きょ": "kyo",
    "しゃ": "sha",
    "しゅ": "shu",
    "しょ": "sho",
    "しぇ": "she",
    "ちゃ": "cha",
    "ちゅ": "chu",
    "ちょ": "cho",
    "ちぇ": "che",
    "にゃ": "nya",
    "にゅ": "nyu",
    "にょ": "nyo",
    "ひゃ": "hya",
    "ひゅ": "hyu",
    "ひょ": "hyo",
    "みゃ": "mya",
    "みゅ": "myu",
    "みょ": "myo",
    "りゃ": "rya",
    "りゅ": "ryu",
    "りょ": "ryo",
    "ぎゃ": "gya",
    "ぎゅ": "gyu",
    "ぎょ": "gyo",
    "じゃ": "ja",
    "じゅ": "ju",
    "じょ": "jo",
    "じぇ": "je",
    "びゃ": "bya",
    "びゅ": "byu",
    "びょ": "byo",
    "ぴゃ": "pya",
    "ぴゅ": "pyu",
    "ぴょ": "pyo",
    "ふぁ": "fa",
    "ふぃ": "fi",
    "ふぇ": "fe",
    "ふぉ": "fo",
    "ふゅ": "fyu",
    "てぃ": "ti",
    "でぃ": "di",
    "とぅ": "tu",
    "どぅ": "du",
    "うぃ": "wi",
    "うぇ": "we",
    "うぉ": "wo",
    "ゔぁ": "va",
    "ゔぃ": "vi",
    "ゔぇ": "ve",
    "ゔぉ": "vo",
}

PUNCTUATION_MAP = {
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
}

PARTICLE_READINGS = {
    "は": "wa",
    "へ": "e",
    "を": "o",
}

SPACE_BEFORE_PUNCTUATION = re.compile(r"\s+([,.;:!?)\]\"])")
SPACE_AFTER_OPENING = re.compile(r'([(\[\"])\s+')
MULTIPLE_SPACES = re.compile(r"\s+")


def _last_vowel(text: str) -> str:
    for character in reversed(text):
        if character in "aeiou":
            return character
    return ""


def romanize_kana(text: str) -> str:
    """将平假名或片假名转换为接近 Hepburn 写法的罗马音。"""
    normalized = katakana_to_hiragana(text)
    output: list[str] = []
    index = 0
    double_next_consonant = False

    while index < len(normalized):
        character = normalized[index]

        if character == "っ":
            double_next_consonant = True
            index += 1
            continue

        if character == "ー":
            vowel = _last_vowel("".join(output))
            if vowel:
                output.append(vowel)
            index += 1
            continue

        if character == "ん":
            next_character = (
                normalized[index + 1] if index + 1 < len(normalized) else ""
            )
            output.append("n'")
            if not next_character or next_character not in "あいうえおやゆよ":
                output[-1] = "n"
            index += 1
            continue

        pair = normalized[index : index + 2]
        if pair in COMBINATION_KANA:
            syllable = COMBINATION_KANA[pair]
            index += 2
        else:
            syllable = SINGLE_KANA.get(
                character,
                PUNCTUATION_MAP.get(character, character),
            )
            index += 1

        if double_next_consonant:
            if syllable.startswith("ch"):
                output.append("t")
            elif syllable and syllable[0] not in "aeiou":
                output.append(syllable[0])
            double_next_consonant = False

        output.append(syllable)

    return "".join(output)


def _effective_reading(segment: LyricsSegment) -> str | None:
    confirmed = (
        segment.confirmed_reading.strip()
        if segment.confirmed_reading
        else ""
    )
    if confirmed:
        return confirmed
    return (
        segment.detected_reading.strip()
        if segment.detected_reading
        else None
    )


def romanize_segment(segment: LyricsSegment) -> str:
    """将单个歌词片段转换为罗马音。"""
    if not segment.surface.strip():
        return ""

    if (
        segment.part_of_speech == "助詞"
        and segment.surface in PARTICLE_READINGS
    ):
        return PARTICLE_READINGS[segment.surface]

    reading = _effective_reading(segment)
    return romanize_kana(reading or segment.surface)


def build_line_romaji(segments: list[LyricsSegment]) -> str:
    """根据当前有效读音生成整行罗马音。"""
    parts = [
        romanize_segment(segment).strip()
        for segment in segments
        if segment.surface.strip()
    ]
    romaji = MULTIPLE_SPACES.sub(
        " ",
        " ".join(part for part in parts if part),
    ).strip()
    romaji = SPACE_BEFORE_PUNCTUATION.sub(r"\1", romaji)
    return SPACE_AFTER_OPENING.sub(r"\1", romaji)
