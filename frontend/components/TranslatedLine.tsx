"use client";

import { useTranslation } from "@/components/TranslationProvider";
import type { LyricsLine } from "@/lib/types";

export default function TranslatedLine({
  line,
  gap,
  className = "",
}: {
  line: LyricsLine;
  gap?: number;
  className?: string;
}) {
  const { isVisible, translationFor } = useTranslation();
  const translation = translationFor(line);

  if (!isVisible || !translation) {
    return null;
  }

  return (
    <p
      data-translation-line={line.line_index}
      className={`break-words text-[13px] leading-6 text-muted [overflow-wrap:anywhere] ${className}`}
      style={gap === undefined ? undefined : { marginTop: `${gap}px` }}
    >
      {translation}
    </p>
  );
}
