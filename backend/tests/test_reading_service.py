"""读音规范化与可信度规则测试。"""

from app.services.reading_service import (
    contains_kanji,
    decide_reading,
    katakana_to_hiragana,
)


def test_katakana_to_hiragana() -> None:
    assert katakana_to_hiragana("サガシテイル") == "さがしている"
    assert katakana_to_hiragana("コーヒー") == "こーひー"


def test_non_kanji_does_not_require_annotation() -> None:
    decision = decide_reading(
        surface="カタカナ",
        reading_form="カタカナ",
        is_oov=False,
    )

    assert contains_kanji("カタカナ") is False
    assert decision.reading is None
    assert decision.source == "not-required"
    assert decision.needs_review is False


def test_oov_kanji_reading_is_marked_for_review() -> None:
    decision = decide_reading(
        surface="龍",
        reading_form="リュウ",
        is_oov=True,
    )

    assert decision.reading == "りゅう"
    assert decision.source == "sudachi-oov-estimate"
    assert decision.needs_review is True
    assert decision.notes


def test_missing_kanji_reading_is_marked_for_review() -> None:
    decision = decide_reading(
        surface="龘",
        reading_form="龘",
        is_oov=True,
    )

    assert decision.reading is None
    assert decision.source == "unavailable"
    assert decision.needs_review is True
