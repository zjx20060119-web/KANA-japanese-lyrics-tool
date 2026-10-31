"use client";

import { useId, useState } from "react";

import { useDisplaySettings } from "@/components/DisplaySettingsProvider";
import ReadingEditor from "@/components/ReadingEditor";
import RomajiLine from "@/components/RomajiLine";
import RubyText from "@/components/RubyText";
import TranslatedLine from "@/components/TranslatedLine";
import type { LyricsLine } from "@/lib/types";

type LyricsLineItemProps = {
  line: LyricsLine;
  onReadingApply: (
    lineId: string,
    readings: Record<string, string>,
  ) => void;
};

export default function LyricsLineItem({
  line,
  onReadingApply,
}: LyricsLineItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { settings } = useDisplaySettings();
  const editorId = useId();
  const lineNumber = String(line.line_index + 1).padStart(2, "0");
  const needsReview = line.segments.some((segment) => segment.needs_review);
  const confirmedCount = line.segments.filter(
    (segment) => segment.confirmed_reading,
  ).length;

  if (line.is_blank) {
    return (
      <div
        className="flex min-h-6 items-center gap-4 border-b border-line py-1 last:border-b-0 sm:min-h-8"
        aria-label={`第 ${line.line_index + 1} 行为空行`}
        data-line-index={line.line_index}
        data-original-text={line.original_text}
      >
        <span className="w-6 shrink-0 text-xs tabular-nums text-muted">
          {lineNumber}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }

  return (
    <article
      className="min-w-0 border-b border-line last:border-b-0"
      style={{
        paddingTop: settings.rowGap / 2,
        paddingBottom: settings.rowGap / 2,
      }}
      data-line-index={line.line_index}
      data-original-text={line.original_text}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="w-6 shrink-0 pt-2 text-xs tabular-nums text-muted">
          {lineNumber}
        </span>

        <div className="min-w-0 flex-1">
          <div
            className="font-japanese break-words leading-[1.75] text-ink [overflow-wrap:anywhere]"
            style={{ fontSize: `${settings.lyricSize}px` }}
          >
            <RubyText segments={line.segments} />
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            style={{
              marginTop: `${settings.showRomaji ? settings.romajiGap : 2}px`,
            }}
          >
            {settings.showRomaji && (
              <RomajiLine
                romaji={line.romaji}
                fontSize={settings.romajiSize}
                showMarker={false}
              />
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
              {confirmedCount > 0 && (
                <span className="rounded-full bg-[#f1faf3] px-2.5 py-1 text-[10px] text-success">
                  已确认 {confirmedCount}
                </span>
              )}
              {needsReview && (
                <span className="rounded-full bg-[#fff8ed] px-2.5 py-1 text-[10px] text-[#8a4f00]">
                  待校对
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-expanded={isEditing}
                aria-controls={editorId}
                className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-line px-2 text-[10px] font-medium text-muted transition hover:bg-surface hover:text-ink sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[11px]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                >
                  <path d="m10.8 2.7 2.5 2.5L5.6 12.9l-3.3.8.8-3.3 7.7-7.7Z" />
                </svg>
                修正读音
              </button>
            </div>
          </div>
          <TranslatedLine line={line} gap={settings.translationGap} />

          {isEditing && (
            <div id={editorId}>
              <ReadingEditor
                lineId={line.id}
                segments={line.segments}
                onClose={() => setIsEditing(false)}
                onApplyReadings={onReadingApply}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
