"""Sudachi 读音的规范化与可信度判断。"""

from dataclasses import dataclass

KATAKANA_START = 0x30A1
KATAKANA_END = 0x30F6
HIRAGANA_START = 0x3041
HIRAGANA_END = 0x3096
KANJI_HELPERS = frozenset("々〆ヶ")


def contains_kanji(text: str) -> bool:
    """判断文本是否包含需要注音的汉字。"""
    for character in text:
        codepoint = ord(character)
        if character in KANJI_HELPERS:
            return True
        if 0x3400 <= codepoint <= 0x4DBF:
            return True
        if 0x4E00 <= codepoint <= 0x9FFF:
            return True
        if 0xF900 <= codepoint <= 0xFAFF:
            return True
        if 0x20000 <= codepoint <= 0x2FA1F:
            return True
    return False


def katakana_to_hiragana(text: str) -> str:
    """将 Sudachi 返回的片假名读音转换为平假名。"""
    converted: list[str] = []
    for character in text:
        codepoint = ord(character)
        if KATAKANA_START <= codepoint <= KATAKANA_END:
            converted.append(chr(codepoint - 0x60))
        else:
            converted.append(character)
    return "".join(converted)


def normalize_reading(reading_form: str) -> str | None:
    """清理词典读音；无效或不可读的值返回 None。"""
    reading = reading_form.strip()
    if not reading or reading == "*":
        return None

    hiragana_reading = katakana_to_hiragana(reading)
    has_hiragana = any(
        HIRAGANA_START <= ord(character) <= HIRAGANA_END
        for character in hiragana_reading
    )
    return hiragana_reading if has_hiragana else None


@dataclass(frozen=True)
class ReadingDecision:
    """单个片段读音及可信度。"""

    reading: str | None
    source: str
    needs_review: bool
    notes: tuple[str, ...] = ()


def decide_reading(
    surface: str,
    reading_form: str,
    is_oov: bool,
) -> ReadingDecision:
    """根据表面文本和词典读音决定是否生成注音。"""
    if not contains_kanji(surface):
        return ReadingDecision(
            reading=None,
            source="not-required",
            needs_review=False,
        )

    reading = normalize_reading(reading_form)
    if reading is None:
        return ReadingDecision(
            reading=None,
            source="unavailable",
            needs_review=True,
            notes=("词典未提供可靠读音，请人工确认。",),
        )

    if is_oov:
        return ReadingDecision(
            reading=reading,
            source="sudachi-oov-estimate",
            needs_review=True,
            notes=("词语未收录于词典，读音为自动估计，请人工确认。",),
        )

    return ReadingDecision(
        reading=reading,
        source="sudachi-dictionary",
        needs_review=False,
    )
