"use client";

import { useEffect, useRef, useState } from "react";

import { fetchLyricsSource, searchLyrics } from "@/lib/api";
import type {
  LyricsSearchResult,
  LyricsSourceContent,
} from "@/lib/types";

type LyricsSourceSearchProps = {
  title: string;
  artist: string;
  disabled: boolean;
  onUseLyrics: (content: LyricsSourceContent) => void;
};

type SearchState =
  | { phase: "idle" }
  | { phase: "searching" }
  | { phase: "results"; query: string; results: LyricsSearchResult[] }
  | {
      phase: "error";
      message: string;
      query?: string;
      results?: LyricsSearchResult[];
    };

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function LyricsSourceSearch({
  title,
  artist,
  disabled,
  onUseLyrics,
}: LyricsSourceSearchProps) {
  const [state, setState] = useState<SearchState>({ phase: "idle" });
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] =
    useState<LyricsSourceContent | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const beginRequest = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  };

  const handleSearch = async () => {
    if (!title.trim() && !artist.trim()) {
      setState({ phase: "error", message: "请至少填写歌名或歌手。" });
      return;
    }

    const controller = beginRequest();
    setState({ phase: "searching" });
    setSelectedSource(null);

    try {
      const response = await searchLyrics(
        title,
        artist,
        controller.signal,
      );
      if (controllerRef.current !== controller) {
        return;
      }

      if (response.results.length === 0) {
        setState({
          phase: "error",
          message:
            "没有找到可用歌词。你可以修改歌名或歌手，也可以直接在下方手动粘贴。",
        });
      } else {
        setState({
          phase: "results",
          query: response.query,
          results: response.results,
        });
      }
    } catch (error) {
      if (controllerRef.current === controller) {
        setState({
          phase: "error",
          message:
            error instanceof Error
              ? `${error.message} 你仍可以在下方手动粘贴歌词。`
              : "歌词搜索失败，你仍可以在下方手动粘贴歌词。",
        });
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  const handleUseSource = async (result: LyricsSearchResult) => {
    const previousQuery =
      state.phase === "results"
        ? state.query
        : state.phase === "error"
          ? state.query
          : undefined;
    const previousResults =
      state.phase === "results"
        ? state.results
        : state.phase === "error"
          ? state.results ?? []
          : [];
    const controller = beginRequest();
    setLoadingSourceId(result.source_id);
    setSelectedSource(null);

    try {
      const content = await fetchLyricsSource(
        result.source_id,
        controller.signal,
      );
      if (controllerRef.current !== controller) {
        return;
      }
      onUseLyrics(content);
      setSelectedSource(content);
      setState({ phase: "idle" });
    } catch (error) {
      if (controllerRef.current === controller) {
        setState({
          phase: "error",
          message:
            error instanceof Error
              ? `${error.message} 请手动粘贴歌词。`
              : "歌词获取失败，请手动粘贴歌词。",
          query: previousQuery,
          results: previousResults,
        });
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoadingSourceId(null);
      }
    }
  };

  const visibleResults =
    state.phase === "results" || state.phase === "error"
      ? state.results ?? []
      : [];
  const visibleQuery =
    state.phase === "results"
      ? state.query
      : state.phase === "error"
        ? state.query
        : undefined;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">歌词来源</h3>
          <p className="mt-0.5 text-xs text-muted">
            填写歌名或歌手后搜索
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={disabled || state.phase === "searching"}
          className="h-9 rounded-full border border-line px-4 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-wait disabled:opacity-50"
        >
          {state.phase === "searching" ? "搜索中…" : "搜索歌词"}
        </button>
      </div>

      {state.phase === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-brand/20 bg-[#fff5f5] px-3 py-2 text-xs leading-5 text-brand"
        >
          {state.message}
        </p>
      )}

      {visibleResults.length > 0 && visibleQuery && (
        <div className="mt-3">
          <p className="text-xs text-muted">
            “{visibleQuery}” 的候选
          </p>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleResults.map((result) => {
              const duration = formatDuration(result.duration_seconds);
              return (
                <button
                  key={`${result.source}-${result.source_id}`}
                  type="button"
                  data-source-id={result.source_id}
                  data-track-title={result.title}
                  onClick={() => void handleUseSource(result)}
                  disabled={loadingSourceId !== null}
                  className="flex w-full items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-left transition hover:bg-surface-strong disabled:cursor-wait disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className="font-japanese relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-ink text-2xl text-white"
                  >
                    <span className="absolute left-1.5 top-1.5 h-1 w-5 rounded-full bg-brand" />
                    {Array.from(result.title.trim())[0] || "歌"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-japanese block truncate text-sm font-medium">
                        {result.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10px] text-muted">
                      {loadingSourceId === result.source_id
                        ? "载入中"
                        : "LRCLIB"}
                      </span>
                    </span>
                    <span className="font-japanese mt-0.5 block truncate text-xs text-muted">
                      {result.artist}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                    {result.album && (
                      <span className="rounded-sm bg-canvas px-1.5 py-0.5">
                        {result.album}
                      </span>
                    )}
                    {duration && (
                      <span className="rounded-sm bg-canvas px-1.5 py-0.5">
                        {duration}
                      </span>
                    )}
                    {result.has_synced_lyrics && (
                      <span className="rounded-sm bg-canvas px-1.5 py-0.5">
                        含时间轴
                      </span>
                    )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedSource && (
        <div className="mt-3 rounded-md border border-success/20 bg-[#f1faf3] px-3 py-2.5 text-xs leading-5 text-success">
          已载入《{selectedSource.title}》歌词。来源：
          <a
            href={selectedSource.source_url}
            target="_blank"
            rel="noreferrer"
            className="mx-1 underline decoration-success/30 underline-offset-4 hover:text-link"
          >
            {selectedSource.attribution}
          </a>
        </div>
      )}
    </div>
  );
}
