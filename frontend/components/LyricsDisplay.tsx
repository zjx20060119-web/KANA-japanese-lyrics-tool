import LyricsLineItem from "@/components/LyricsLineItem";
import type {
  AnalysisStatus,
  AnalysisWarning,
  LyricsDocument,
} from "@/lib/types";

type LyricsDisplayProps = {
  status: AnalysisStatus;
  document: LyricsDocument | null;
  errorMessage: string | null;
  onRetry: () => void;
  onReadingApply: (
    lineId: string,
    readings: Record<string, string>,
  ) => void;
  preservedReadingCount: number;
  onClearReadingOverrides: () => void;
};

function EmptyState() {
  return (
    <div className="grid min-h-[26rem] place-items-center rounded-lg bg-surface px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="font-japanese mx-auto text-7xl leading-none text-ink">
          あ
        </div>
        <span className="mx-auto mt-4 block h-1 w-12 rounded-full bg-brand" />
        <h3 className="mt-6 text-lg font-medium">等待一行歌词</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          在左侧填写歌曲信息并粘贴歌词，点击“开始注音”后，这里会展示真实分词、假名和逐行罗马音。
        </p>
        <div className="mt-6 flex justify-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-canvas px-2.5 py-1">
            原文保留
          </span>
          <span className="rounded-full bg-canvas px-2.5 py-1">
            Ruby 注音
          </span>
          <span className="rounded-full bg-canvas px-2.5 py-1">
            逐行罗马音
          </span>
        </div>
      </div>
    </div>
  );
}

function ProcessingState() {
  return (
    <div
      className="min-h-[26rem] rounded-lg bg-surface p-5 sm:p-7"
      aria-busy="true"
    >
      <div className="mb-5 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
        <div>
          <p className="font-medium">正在分析歌词</p>
          <p className="mt-0.5 text-xs text-muted">
            SudachiPy · 分词 · 读音 · 罗马音
          </p>
        </div>
      </div>

      <div className="mt-10 animate-pulse space-y-8">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-3">
            <div
              className="h-7 rounded bg-surface-strong"
              style={{ width: `${88 - index * 13}%` }}
            />
            <div
              className="h-3 rounded bg-surface-strong"
              style={{ width: `${62 - index * 7}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="grid min-h-[26rem] place-items-center rounded-lg border border-brand/20 bg-[#fff7f7] px-6 py-12 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand text-xl text-white">
          !
        </span>
        <h3 className="mt-5 text-lg font-medium">处理没有完成</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 h-10 rounded-full bg-ink px-5 text-xs font-medium text-white transition hover:bg-[#272727]"
        >
          重新尝试
        </button>
        <p className="mt-4 text-[11px] leading-5 text-muted">
          请确认本地 FastAPI 服务正在运行，并检查后端日志。
        </p>
      </div>
    </div>
  );
}

type SuccessStateProps = {
  document: LyricsDocument;
  onReadingApply: (
    lineId: string,
    readings: Record<string, string>,
  ) => void;
  preservedReadingCount: number;
  onClearReadingOverrides: () => void;
};

function WarningsPanel({ warnings }: { warnings: AnalysisWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }

  const visibleWarnings = warnings.slice(0, 4);

  return (
    <div
      role="status"
      className="mt-4 rounded-md border border-warning/20 bg-[#fff8ed] px-3 py-3"
    >
      <p className="text-xs font-medium text-[#8a4f00]">
        需要人工检查 {warnings.length} 项
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#72512d]">
        {visibleWarnings.map((warning, index) => (
          <li
            key={`${warning.code}-${warning.line_index}-${warning.segment_index}-${index}`}
          >
            {warning.line_index !== null
              ? `第 ${warning.line_index + 1} 行`
              : "歌词"}
            {warning.segment_index !== null
              ? ` · 片段 ${warning.segment_index + 1}`
              : ""}
            ：{warning.message}
          </li>
        ))}
      </ul>
      {warnings.length > visibleWarnings.length && (
        <p className="mt-2 text-[11px] text-muted">
          另有 {warnings.length - visibleWarnings.length} 项提示。
        </p>
      )}
    </div>
  );
}

function SuccessState({
  document,
  onReadingApply,
  preservedReadingCount,
  onClearReadingOverrides,
}: SuccessStateProps) {
  const confirmedCount = document.lines.reduce(
    (count, line) =>
      count +
      line.segments.filter((segment) => segment.confirmed_reading).length,
    0,
  );

  return (
    <div className="bg-canvas py-1">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h3 className="font-japanese text-xl font-bold leading-7">
            {document.title || "未命名歌曲"}
          </h3>
          <p className="font-japanese mt-1 text-sm text-muted">
            {document.artist || "未知歌手"}
            {document.album ? ` - ${document.album}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full bg-canvas px-2.5 py-1">
            {document.lines.filter((line) => !line.is_blank).length} 行歌词
          </span>
          <span className="rounded-full bg-canvas px-2.5 py-1">
            原文保留
          </span>
        </div>
      </div>

      {(preservedReadingCount > 0 || confirmedCount > 0) && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/20 bg-[#f1faf3] px-3 py-2.5 text-xs leading-5 text-success"
        >
          <span>
            {preservedReadingCount > 0
              ? `已保留 ${preservedReadingCount} 处人工确认读音，并重新应用到本次分析结果。`
              : ""}
            {" "}当前共确认 {confirmedCount} 处读音，结果保存在当前浏览器。
          </span>
          <button
            type="button"
            onClick={onClearReadingOverrides}
            className="shrink-0 text-xs underline decoration-success/30 underline-offset-4 transition hover:text-ink"
          >
            清除本曲校对
          </button>
        </div>
      )}

      <WarningsPanel warnings={document.warnings} />

      <div className="mt-2">
        {document.lines.map((line) => (
          <LyricsLineItem
            key={line.id}
            line={line}
            onReadingApply={onReadingApply}
          />
        ))}
      </div>
    </div>
  );
}

export default function LyricsDisplay({
  status,
  document,
  errorMessage,
  onRetry,
  onReadingApply,
  preservedReadingCount,
  onClearReadingOverrides,
}: LyricsDisplayProps) {
  return (
    <section
      id="result-panel"
      aria-labelledby="result-heading"
      className="min-w-0 scroll-mt-6 rounded-xl border border-line bg-canvas p-4 sm:p-5"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="result-heading" className="text-xl font-medium leading-7">
            注音结果
          </h2>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
          SudachiPy
        </span>
      </header>

      <div aria-live="polite">
        {status === "idle" && <EmptyState />}
        {status === "processing" && <ProcessingState />}
        {status === "error" && errorMessage && (
          <ErrorState message={errorMessage} onRetry={onRetry} />
        )}
        {status === "success" && document && (
          <SuccessState
            document={document}
            onReadingApply={onReadingApply}
            preservedReadingCount={preservedReadingCount}
            onClearReadingOverrides={onClearReadingOverrides}
          />
        )}
      </div>
    </section>
  );
}
