"""基于 SudachiPy 的日语歌词分析。"""

from functools import lru_cache
from uuid import uuid4

from sudachipy import dictionary, tokenizer
from sudachipy.morpheme import Morpheme

from app.schemas.lyrics import (
    AnalysisWarning,
    LyricsDocument,
    LyricsLine,
    LyricsSegment,
)
from app.services.reading_service import ReadingDecision, decide_reading
from app.services.romaji import build_line_romaji


class AnalyzerUnavailableError(RuntimeError):
    """Sudachi 词典或分析器无法初始化。"""


@lru_cache(maxsize=1)
def _load_dictionary() -> dictionary.Dictionary:
    try:
        return dictionary.Dictionary(dict="core")
    except Exception as error:
        raise AnalyzerUnavailableError("无法加载 Sudachi 核心词典。") from error


@lru_cache(maxsize=1)
def get_sudachi_tokenizer() -> tokenizer.Tokenizer:
    """延迟加载并复用 Sudachi 分词器。"""
    try:
        return _load_dictionary().tokenizer()
    except Exception as error:
        if isinstance(error, AnalyzerUnavailableError):
            raise
        raise AnalyzerUnavailableError("无法初始化 Sudachi 分词器。") from error


def _optional_dictionary_value(value: str) -> str | None:
    normalized = value.strip()
    return normalized if normalized and normalized != "*" else None


class LyricsAnalyzer:
    """把多行歌词转换为保留行结构的分词与读音数据。"""

    def __init__(
        self,
        tokenizer_instance: tokenizer.Tokenizer | None = None,
    ) -> None:
        self._tokenizer_instance = tokenizer_instance

    @property
    def _tokenizer(self) -> tokenizer.Tokenizer:
        if self._tokenizer_instance is None:
            self._tokenizer_instance = get_sudachi_tokenizer()
        return self._tokenizer_instance

    def analyze(
        self,
        text: str,
        title: str | None = None,
        artist: str | None = None,
    ) -> LyricsDocument:
        """分析歌词原文，单行或单词失败时保留原文并给出提示。"""
        document_id = f"lyrics-{uuid4()}"
        warnings: list[AnalysisWarning] = []
        normalized_text = text.replace("\r\n", "\n").replace("\r", "\n")
        line_texts = normalized_text.split("\n")
        lines = [
            self._analyze_line(
                line_text=line_text,
                line_index=line_index,
                document_id=document_id,
                warnings=warnings,
            )
            for line_index, line_text in enumerate(line_texts)
        ]

        return LyricsDocument(
            id=document_id,
            title=title,
            artist=artist,
            original_text=text,
            lines=lines,
            warnings=warnings,
        )

    def _analyze_line(
        self,
        line_text: str,
        line_index: int,
        document_id: str,
        warnings: list[AnalysisWarning],
    ) -> LyricsLine:
        line_id = f"{document_id}-line-{line_index}"
        if not line_text.strip():
            return LyricsLine(
                id=line_id,
                line_index=line_index,
                original_text=line_text,
                segments=[],
                is_blank=True,
            )

        try:
            morphemes = list(
                self._tokenizer.tokenize(
                    line_text,
                    tokenizer.Tokenizer.SplitMode.C,
                )
            )
        except Exception:
            warning = AnalysisWarning(
                code="line_analysis_failed",
                message="该行分词失败，已保留原始文本，请人工确认。",
                line_index=line_index,
            )
            warnings.append(warning)
            return LyricsLine(
                id=line_id,
                line_index=line_index,
                original_text=line_text,
                segments=[
                    self._fallback_segment(
                        surface=line_text,
                        segment_index=0,
                        line_index=line_index,
                        document_id=document_id,
                        source="analysis-failed",
                        note="该行分词失败，已保留原文。",
                    )
                ],
                romaji="",
                is_blank=False,
            )

        segments: list[LyricsSegment] = []
        for segment_index, morpheme in enumerate(morphemes):
            surface = morpheme.surface()
            try:
                segment, decision = self._build_segment(
                    surface=surface,
                    morpheme=morpheme,
                    segment_index=segment_index,
                    line_index=line_index,
                    document_id=document_id,
                )
            except Exception:
                segment = self._fallback_segment(
                    surface=surface,
                    segment_index=segment_index,
                    line_index=line_index,
                    document_id=document_id,
                    source="analysis-failed",
                    note="该词语分析失败，已保留原文。",
                )
                warnings.append(
                    AnalysisWarning(
                        code="segment_analysis_failed",
                        message="该词语分析失败，已保留原文，请人工确认。",
                        line_index=line_index,
                        segment_index=segment_index,
                    )
                )
            else:
                if decision.needs_review:
                    warnings.append(
                        AnalysisWarning(
                            code="reading_requires_review",
                            message=decision.notes[0]
                            if decision.notes
                            else "该词语读音需要人工确认。",
                            line_index=line_index,
                            segment_index=segment_index,
                        )
                    )

            segments.append(segment)

        return LyricsLine(
            id=line_id,
            line_index=line_index,
            original_text=line_text,
            segments=segments,
            romaji=build_line_romaji(segments),
            is_blank=False,
        )

    def _build_segment(
        self,
        surface: str,
        morpheme: Morpheme,
        segment_index: int,
        line_index: int,
        document_id: str,
    ) -> tuple[LyricsSegment, ReadingDecision]:
        part_of_speech_detail = [
            str(value) for value in morpheme.part_of_speech()
        ]
        part_of_speech = (
            part_of_speech_detail[0]
            if part_of_speech_detail and part_of_speech_detail[0] != "*"
            else None
        )
        dictionary_form = _optional_dictionary_value(
            morpheme.dictionary_form()
        )
        is_oov = bool(morpheme.is_oov())
        decision = decide_reading(
            surface=surface,
            reading_form=morpheme.reading_form(),
            is_oov=is_oov,
        )

        return (
            LyricsSegment(
                id=(
                    f"{document_id}-line-{line_index}"
                    f"-segment-{segment_index}"
                ),
                segment_index=segment_index,
                surface=surface,
                part_of_speech=part_of_speech,
                part_of_speech_detail=part_of_speech_detail,
                dictionary_form=dictionary_form,
                detected_reading=decision.reading,
                confirmed_reading=None,
                effective_reading=decision.reading,
                reading_source=decision.source,
                reading_type=None,
                needs_review=decision.needs_review,
                is_oov=is_oov,
                notes=list(decision.notes),
            ),
            decision,
        )

    @staticmethod
    def _fallback_segment(
        surface: str,
        segment_index: int,
        line_index: int,
        document_id: str,
        source: str,
        note: str,
    ) -> LyricsSegment:
        return LyricsSegment(
            id=(
                f"{document_id}-line-{line_index}"
                f"-segment-{segment_index}"
            ),
            segment_index=segment_index,
            surface=surface,
            part_of_speech=None,
            part_of_speech_detail=[],
            dictionary_form=None,
            detected_reading=None,
            confirmed_reading=None,
            effective_reading=None,
            reading_source=source,
            reading_type=None,
            needs_review=True,
            is_oov=False,
            notes=[note],
        )
