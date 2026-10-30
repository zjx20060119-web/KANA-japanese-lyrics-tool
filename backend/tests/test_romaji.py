"""假名转罗马音测试。"""

from app.schemas.lyrics import LyricsSegment
from app.services.romaji import build_line_romaji, romanize_kana


def make_segment(
    surface: str,
    reading: str | None = None,
    confirmed_reading: str | None = None,
    part_of_speech: str = "名詞",
) -> LyricsSegment:
    return LyricsSegment(
        id=f"segment-{surface}",
        segment_index=0,
        surface=surface,
        part_of_speech=part_of_speech,
        part_of_speech_detail=[],
        dictionary_form=surface,
        detected_reading=reading,
        confirmed_reading=confirmed_reading,
        effective_reading=confirmed_reading or reading,
        reading_source="test",
        reading_type=None,
        needs_review=False,
        is_oov=False,
    )


def test_romanizes_common_kana_rules() -> None:
    assert romanize_kana("きょう") == "kyou"
    assert romanize_kana("しゃしん") == "shashin"
    assert romanize_kana("がっこう") == "gakkou"
    assert romanize_kana("しんよう") == "shin'you"
    assert romanize_kana("コーヒー") == "koohii"
    assert romanize_kana("ふぁんたじー") == "fantajii"


def test_builds_line_romaji_with_particle_readings() -> None:
    segments = [
        make_segment("今日", "きょう"),
        make_segment("は", part_of_speech="助詞"),
        make_segment("晴れ", "はれ"),
        make_segment("。", part_of_speech="補助記号"),
    ]

    assert build_line_romaji(segments) == "kyou wa hare."


def test_builds_mixed_script_line_romaji() -> None:
    segments = [
        make_segment("東京", "とうきょう"),
        make_segment("で", part_of_speech="助詞"),
        make_segment("ライブ"),
        make_segment("を", part_of_speech="助詞"),
        make_segment("歌う", "うたう"),
        make_segment("！", part_of_speech="補助記号"),
    ]

    assert build_line_romaji(segments) == "toukyou de raibu o utau!"


def test_confirmed_reading_has_priority() -> None:
    segment = make_segment(
        "夜",
        reading="よる",
        confirmed_reading="よ",
    )

    assert build_line_romaji([segment]) == "yo"


def test_unknown_text_is_preserved() -> None:
    assert build_line_romaji([make_segment("龘")]) == "龘"
