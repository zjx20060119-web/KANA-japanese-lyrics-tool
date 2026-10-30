import { buildLineRomaji } from "@/lib/romaji";
import type { LyricsDocument } from "@/lib/types";

export type ReadingOverrides = Record<string, string>;

export function getReadingOverrideKey(
  lineIndex: number,
  segmentIndex: number,
  surface: string,
): string {
  return `${lineIndex}:${segmentIndex}:${surface}`;
}

export function collectReadingOverrides(
  document: LyricsDocument,
): ReadingOverrides {
  const overrides: ReadingOverrides = {};
  for (const line of document.lines) {
    for (const segment of line.segments) {
      const reading = segment.confirmed_reading?.trim();
      if (!reading) {
        continue;
      }
      overrides[
        getReadingOverrideKey(
          line.line_index,
          segment.segment_index,
          segment.surface,
        )
      ] = reading;
    }
  }
  return overrides;
}

export function applyReadingOverrides(
  document: LyricsDocument,
  overrides: ReadingOverrides,
): { document: LyricsDocument; restoredCount: number } {
  let restoredCount = 0;

  const lines = document.lines.map((line) => {
    const correctedSegmentIndexes = new Set<number>();
    const segments = line.segments.map((segment) => {
      const key = getReadingOverrideKey(
        line.line_index,
        segment.segment_index,
        segment.surface,
      );
      const confirmedReading = overrides[key]?.trim();

      if (!confirmedReading) {
        return segment;
      }

      restoredCount += 1;
      correctedSegmentIndexes.add(segment.segment_index);
      return {
        ...segment,
        confirmed_reading: confirmedReading,
        effective_reading: confirmedReading,
        needs_review: false,
      };
    });

    if (correctedSegmentIndexes.size === 0) {
      return line;
    }

    return {
      ...line,
      segments,
      romaji: buildLineRomaji(segments),
    };
  });

  const warnings = document.warnings.filter(
    (warning) =>
      warning.line_index === null ||
      warning.segment_index === null ||
      !lines[warning.line_index]?.segments[
        warning.segment_index
      ]?.confirmed_reading,
  );

  return {
    document: { ...document, lines, warnings },
    restoredCount,
  };
}
