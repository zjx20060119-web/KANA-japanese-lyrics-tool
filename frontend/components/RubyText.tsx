import { getEffectiveReading } from "@/lib/romaji";
import type { LyricsSegment } from "@/lib/types";

const KANJI_PATTERN = /[一-龯々〆ヶ]/u;
const HIRAGANA_PATTERN = /^[\u3040-\u309fー]$/u;

function splitTrailingKana(surface: string, reading: string) {
  const surfaceCharacters = Array.from(surface);
  const readingCharacters = Array.from(reading);
  let suffixLength = 0;

  while (
    suffixLength < surfaceCharacters.length &&
    suffixLength < readingCharacters.length
  ) {
    const surfaceCharacter =
      surfaceCharacters[surfaceCharacters.length - 1 - suffixLength];
    const readingCharacter =
      readingCharacters[readingCharacters.length - 1 - suffixLength];

    if (
      surfaceCharacter !== readingCharacter ||
      !HIRAGANA_PATTERN.test(surfaceCharacter)
    ) {
      break;
    }

    suffixLength += 1;
  }

  return {
    surface: surfaceCharacters
      .slice(0, surfaceCharacters.length - suffixLength)
      .join(""),
    reading: readingCharacters
      .slice(0, readingCharacters.length - suffixLength)
      .join(""),
    suffix: surfaceCharacters
      .slice(surfaceCharacters.length - suffixLength)
      .join(""),
  };
}

type RubyTextProps = {
  segments: LyricsSegment[];
};

export default function RubyText({ segments }: RubyTextProps) {
  return (
    <span className="font-japanese whitespace-pre-wrap [overflow-wrap:anywhere]">
      {segments.map((segment) => {
        const reading = getEffectiveReading(segment);

        if (!reading || !KANJI_PATTERN.test(segment.surface)) {
          return <span key={segment.id}>{segment.surface}</span>;
        }

        const rubyParts = splitTrailingKana(segment.surface, reading);
        if (!rubyParts.surface || !rubyParts.reading) {
          return <span key={segment.id}>{segment.surface}</span>;
        }

        return (
          <span key={segment.id}>
            <ruby className="mx-[0.02em] [ruby-align:center]">
              {rubyParts.surface}
              <rt className="text-[0.48em] font-medium tracking-[0.02em] text-brand">
                {rubyParts.reading}
              </rt>
            </ruby>
            {rubyParts.suffix}
          </span>
        );
      })}
    </span>
  );
}
