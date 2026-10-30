import { useState } from "react";

import { getEffectiveReading } from "@/lib/romaji";
import type { LyricsSegment } from "@/lib/types";

type ReadingEditorProps = {
  lineId: string;
  segments: LyricsSegment[];
  onClose: () => void;
  onApplyReadings: (
    lineId: string,
    readings: Record<string, string>,
  ) => void;
};

function getEditableSegments(segments: LyricsSegment[]): LyricsSegment[] {
  return segments.filter(
    (segment) =>
      segment.detected_reading ||
      segment.confirmed_reading ||
      segment.needs_review,
  );
}

export default function ReadingEditor({
  lineId,
  segments,
  onClose,
  onApplyReadings,
}: ReadingEditorProps) {
  const editableSegments = getEditableSegments(segments);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editableSegments.map((segment) => [
        segment.id,
        segment.confirmed_reading ||
          getEffectiveReading(segment) ||
          "",
      ]),
    ),
  );
  const [hasApplied, setHasApplied] = useState(false);
  const changedReadings = Object.fromEntries(
    editableSegments
      .map((segment) => {
        const draft = drafts[segment.id]?.trim() ?? "";
        const currentReading =
          segment.confirmed_reading ||
          getEffectiveReading(segment) ||
          "";
        return [segment.id, draft, currentReading] as const;
      })
      .filter(
        ([, draft, currentReading]) =>
          draft && draft !== currentReading,
      )
      .map(([segmentId, draft]) => [segmentId, draft]),
  );
  const canApply =
    Object.keys(changedReadings).length > 0 &&
    editableSegments.every((segment) => drafts[segment.id]?.trim());

  const updateDraft = (segmentId: string, value: string) => {
    setDrafts((current) => ({ ...current, [segmentId]: value }));
    setHasApplied(false);
  };

  const applyReadings = () => {
    onApplyReadings(lineId, changedReadings);
    setHasApplied(true);
  };

  const confirmCandidate = (segment: LyricsSegment) => {
    const candidate = segment.detected_reading?.trim();
    if (!candidate) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [segment.id]: candidate,
    }));
    onApplyReadings(lineId, { [segment.id]: candidate });
    setHasApplied(true);
  };

  return (
    <div className="mt-4 min-w-0 rounded-lg bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">读音修正</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-full border border-line bg-canvas px-3 text-xs text-muted transition hover:text-ink"
        >
          收起
        </button>
      </div>

      {editableSegments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {editableSegments.map((segment, index) => (
            <div
              key={segment.id}
              className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center"
            >
              <label
                htmlFor={`${lineId}-${segment.id}-reading`}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <span className="font-japanese min-w-12">{segment.surface}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-normal ${
                    segment.confirmed_reading
                      ? "bg-[#e9f7ed] text-success"
                      : "bg-canvas text-muted"
                  }`}
                >
                  {segment.confirmed_reading
                    ? "已确认"
                    : `系统候选 ${index + 1}`}
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${lineId}-${segment.id}-reading`}
                  type="text"
                  value={drafts[segment.id] ?? ""}
                  onChange={(event) =>
                    updateDraft(segment.id, event.target.value)
                  }
                  placeholder="输入假名读音"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-japanese h-10 min-w-0 flex-1 rounded-md border border-transparent bg-canvas px-3 text-sm outline-none transition placeholder:text-muted focus:border-ink"
                />
                {segment.detected_reading &&
                  segment.confirmed_reading !==
                    segment.detected_reading && (
                    <button
                      type="button"
                      onClick={() => confirmCandidate(segment)}
                      className="h-10 shrink-0 rounded-md border border-line bg-canvas px-3 text-xs font-medium text-ink transition hover:bg-surface-strong"
                    >
                      确认候选
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-canvas px-3 py-3 text-xs leading-5 text-muted">
          本行没有需要修正的汉字读音。
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p
          className="text-xs leading-5 text-muted"
          aria-live="polite"
        >
          {hasApplied
            ? "已应用修正，本行罗马音已重新计算。"
            : "仅应用改动字段；未修改的候选可用右侧按钮单独确认。"}
        </p>
        {editableSegments.length > 0 && (
          <button
            type="button"
            onClick={applyReadings}
            disabled={!canApply}
            className="h-9 rounded-full bg-brand px-4 text-xs font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            应用修正
          </button>
        )}
      </div>
    </div>
  );
}
