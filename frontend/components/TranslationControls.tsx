"use client";

import { useTranslation } from "@/components/TranslationProvider";

function TranslateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h8M7 2.5V4M9.5 4c-.5 3-2.2 5.3-5.5 7" />
      <path d="M5.5 7.2c1.1 1.7 2.7 2.9 4.8 3.5M12 17l3-7 3 7M13.1 14.5h3.8" />
    </svg>
  );
}

const ENGINE_LABELS = {
  online: "微软翻译",
  dictionary: "离线释义",
  mixed: "微软 + 离线补全",
  cache: "已缓存",
} as const;

export default function TranslationControls({
  compact = false,
  engineFirst = false,
}: {
  compact?: boolean;
  engineFirst?: boolean;
}) {
  const { state, isVisible, start, show, hide, retry } = useTranslation();
  const isLoading = state.phase === "loading";
  const isSuccess = state.phase === "success";
  const engineBadge =
    isSuccess && isVisible ? (
      <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] text-muted">
        {ENGINE_LABELS[state.engine]}
      </span>
    ) : null;

  const onClick = () => {
    if (isLoading || state.phase === "error") {
      return;
    }
    if (isSuccess) {
      if (isVisible) {
        hide();
      } else {
        show();
      }
      return;
    }
    start();
  };

  return (
    <div className={compact ? "min-w-0" : "min-w-0"}>
      <div className="flex flex-wrap items-center gap-2">
        {engineFirst && engineBadge}
        <button
          type="button"
          onClick={onClick}
          disabled={isLoading}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border border-line font-medium text-ink transition hover:bg-surface disabled:cursor-wait disabled:opacity-60 ${
            compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-xs"
          }`}
        >
          {isLoading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" />
          ) : (
            <TranslateIcon />
          )}
          {isLoading
            ? "正在翻译…"
            : isSuccess
              ? isVisible
                ? "隐藏译文"
                : "显示译文"
              : "翻译歌词"}
        </button>
        {!engineFirst && engineBadge}
      </div>
      {state.phase === "error" && (
        <p
          role="alert"
          className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-5 text-brand"
        >
          <span>{state.message}</span>
          <button
            type="button"
            onClick={retry}
            className="underline decoration-brand/30 underline-offset-4"
          >
            重试
          </button>
        </p>
      )}
    </div>
  );
}
