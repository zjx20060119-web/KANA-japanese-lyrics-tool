"""Sudachi 歌词分析服务测试。"""

import pytest

from app.schemas.lyrics import LyricsSegment
from app.services.analyzer import LyricsAnalyzer


@pytest.fixture(scope="module")
def analyzer() -> LyricsAnalyzer:
    return LyricsAnalyzer()


def find_segment(
    line_segments: list[LyricsSegment],
    surface: str,
) -> LyricsSegment:
    return next(
        segment
        for segment in line_segments
        if segment.surface == surface
    )


def test_analyzes_normal_japanese_sentence(
    analyzer: LyricsAnalyzer,
) -> None:
    document = analyzer.analyze("夜に駆ける")

    assert len(document.lines) == 1
    line = document.lines[0]
    assert line.line_index == 0
    assert line.original_text == "夜に駆ける"
    assert "".join(segment.surface for segment in line.segments) == (
        "夜に駆ける"
    )
    assert line.romaji == "yoru ni kakeru"

    night = find_segment(line.segments, "夜")
    assert night.detected_reading == "よる"
    assert night.effective_reading == "よる"
    assert night.confirmed_reading is None
    assert night.part_of_speech == "名詞"
    assert night.needs_review is False


def test_mixed_scripts_and_punctuation_are_preserved(
    analyzer: LyricsAnalyzer,
) -> None:
    text = "東京でライブを歌う！ABC 123。"
    document = analyzer.analyze(text)
    line = document.lines[0]

    assert "".join(segment.surface for segment in line.segments) == text
    assert find_segment(line.segments, "東京").detected_reading == "とうきょう"
    assert find_segment(line.segments, "ライブ").detected_reading is None
    assert find_segment(line.segments, "ABC").detected_reading is None
    assert find_segment(line.segments, "123").detected_reading is None
    assert find_segment(line.segments, "！").detected_reading is None


def test_multiline_blank_line_and_order_are_preserved(
    analyzer: LyricsAnalyzer,
) -> None:
    document = analyzer.analyze("夜に駆ける\n\n沈むように\n")

    assert [line.line_index for line in document.lines] == [0, 1, 2, 3]
    assert [line.original_text for line in document.lines] == [
        "夜に駆ける",
        "",
        "沈むように",
        "",
    ]
    assert [line.is_blank for line in document.lines] == [
        False,
        True,
        False,
        True,
    ]
    assert document.lines[1].segments == []


def test_duplicate_lines_and_special_symbols_are_preserved(
    analyzer: LyricsAnalyzer,
) -> None:
    text = (
        "同じ歌を歌う\n"
        "同じ歌を歌う\n"
        "\n"
        "♪ ★ ☆ # 123 ABC こんにちは！？…"
    )
    document = analyzer.analyze(text)

    assert len(document.lines) == 4
    assert document.lines[0].id != document.lines[1].id
    assert document.lines[0].original_text == document.lines[1].original_text
    assert [
        segment.detected_reading
        for segment in document.lines[0].segments
    ] == [
        segment.detected_reading
        for segment in document.lines[1].segments
    ]
    assert document.lines[2].is_blank is True

    symbol_line = document.lines[3]
    assert "".join(segment.surface for segment in symbol_line.segments) == (
        symbol_line.original_text
    )
    assert "♪ ★ ☆ # 123 ABC こんにちは！？…" == symbol_line.original_text
    for segment in symbol_line.segments:
        if segment.surface in "♪★☆#！？…":
            assert segment.detected_reading is None
            assert segment.needs_review is False


def test_contextual_readings_for_multiple_reading_words(
    analyzer: LyricsAnalyzer,
) -> None:
    document = analyzer.analyze("今日は晴れ。明日は雨。")
    line = document.lines[0]

    today = find_segment(line.segments, "今日")
    tomorrow = find_segment(line.segments, "明日")

    assert today.detected_reading == "きょう"
    assert today.reading_source == "sudachi-dictionary"
    assert tomorrow.detected_reading == "あす"
    assert tomorrow.reading_source == "sudachi-dictionary"
    assert line.romaji == "kyou wa hare. asu wa ame."


def test_same_kanji_has_different_readings_in_different_words(
    analyzer: LyricsAnalyzer,
) -> None:
    document = analyzer.analyze("生きる 生まれる 生徒")
    line = document.lines[0]

    assert find_segment(line.segments, "生きる").detected_reading == "いきる"
    assert find_segment(line.segments, "生まれる").detected_reading == (
        "うまれる"
    )
    assert find_segment(line.segments, "生徒").detected_reading == "せいと"


def test_unreadable_kanji_is_kept_and_marked_for_review(
    analyzer: LyricsAnalyzer,
) -> None:
    document = analyzer.analyze("龘")
    line = document.lines[0]
    segment = line.segments[0]

    assert segment.surface == "龘"
    assert segment.detected_reading is None
    assert segment.needs_review is True
    assert segment.reading_source == "unavailable"
    assert segment.notes
    assert any(
        warning.code == "reading_requires_review"
        for warning in document.warnings
    )


class RaisingTokenizer:
    """模拟某个词或整行无法分析的情况。"""

    def tokenize(self, text: str, mode: object):
        raise RuntimeError("simulated tokenizer failure")


class FakeMorpheme:
    def __init__(
        self,
        surface: str,
        reading_form: str,
        fail_reading: bool = False,
    ) -> None:
        self._surface = surface
        self._reading_form = reading_form
        self._fail_reading = fail_reading

    def surface(self) -> str:
        return self._surface

    def part_of_speech(self) -> tuple[str, ...]:
        return ("名詞", "普通名詞", "一般", "*", "*", "*")

    def dictionary_form(self) -> str:
        return self._surface

    def reading_form(self) -> str:
        if self._fail_reading:
            raise RuntimeError("simulated reading failure")
        return self._reading_form

    def is_oov(self) -> bool:
        return False


class PartialFailureTokenizer:
    def tokenize(self, text: str, mode: object):
        return [
            FakeMorpheme("夜", "ヨル"),
            FakeMorpheme("壊", "", fail_reading=True),
        ]


def test_line_failure_keeps_original_text() -> None:
    analyzer = LyricsAnalyzer(tokenizer_instance=RaisingTokenizer())

    document = analyzer.analyze("夜空に歌う")
    line = document.lines[0]

    assert line.original_text == "夜空に歌う"
    assert len(line.segments) == 1
    assert line.segments[0].surface == "夜空に歌う"
    assert line.segments[0].needs_review is True
    assert document.warnings[0].code == "line_analysis_failed"


def test_segment_failure_does_not_discard_other_segments() -> None:
    analyzer = LyricsAnalyzer(tokenizer_instance=PartialFailureTokenizer())

    document = analyzer.analyze("夜壊")
    line = document.lines[0]

    assert [segment.surface for segment in line.segments] == ["夜", "壊"]
    assert line.segments[0].detected_reading == "よる"
    assert line.segments[1].detected_reading is None
    assert line.segments[1].needs_review is True
    assert any(
        warning.code == "segment_analysis_failed"
        for warning in document.warnings
    )
