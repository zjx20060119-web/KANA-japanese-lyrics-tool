"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import DocumentSyncPanel from "@/components/DocumentSyncPanel";
import LyricsDisplay from "@/components/LyricsDisplay";
import LyricsInput from "@/components/LyricsInput";
import SavedLyricsView from "@/components/SavedLyricsView";
import { analyzeLyrics, getSavedDocument } from "@/lib/api";
import {
  applyReadingOverrides,
  collectReadingOverrides,
  getReadingOverrideKey,
  type ReadingOverrides,
} from "@/lib/readingOverrides";
import {
  SAMPLE_LYRICS,
  SAMPLE_SONG_ARTIST,
  SAMPLE_SONG_TITLE,
} from "@/lib/sampleLyrics";
import {
  clearReadingOverrides,
  getLyricsStorageKey,
  loadReadingOverrides,
  saveReadingOverrides,
} from "@/lib/storage";
import type {
  AnalysisStatus,
  LyricsDocument,
  LyricsSourceContent,
} from "@/lib/types";

const ANALYSIS_TIMEOUT_MS = 30_000;

function getAnalysisErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "分析超时，请确认后端服务正在运行后重试。";
  }

  return error instanceof Error
    ? error.message
    : "歌词分析请求失败，请稍后重试。";
}

export default function LyricsWorkspace() {
  const searchParams = useSearchParams();
  const initialDocumentId = searchParams.get("open");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [document, setDocument] = useState<LyricsDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [preservedReadingCount, setPreservedReadingCount] = useState(0);
  const [viewMode, setViewMode] = useState<"reader" | "editor">(
    initialDocumentId ? "reader" : "editor",
  );
  const [isLoadingSaved, setIsLoadingSaved] = useState(
    Boolean(initialDocumentId),
  );
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const analyzedTextRef = useRef<string | null>(null);
  const readingContextRef = useRef<{
    key: string;
    overrides: ReadingOverrides;
  } | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const getOverridesForText = (text: string): ReadingOverrides => {
    const key = getLyricsStorageKey(text);
    const stored = loadReadingOverrides(text);
    const inMemory =
      readingContextRef.current?.key === key
        ? readingContextRef.current.overrides
        : {};
    const merged = { ...stored, ...inMemory };
    readingContextRef.current = { key, overrides: merged };
    return merged;
  };

  const resetResult = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPreservedReadingCount(0);
    setStatus("idle");
    setDocument(null);
    setErrorMessage(null);
  };

  const startAnalysis = async () => {
    if (!lyrics.trim()) {
      setValidationError("请先输入歌词，再开始注音。");
      resetResult();
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setValidationError(null);
    setStatus("processing");
    setDocument(null);
    setErrorMessage(null);

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      ANALYSIS_TIMEOUT_MS,
    );

    try {
      const analyzed = await analyzeLyrics(
        { text: lyrics, title, artist },
        controller.signal,
      );
      if (controllerRef.current === controller) {
        const analyzedDocument = {
          ...analyzed,
          album: album.trim() || null,
        };
        const restored = applyReadingOverrides(
          analyzedDocument,
          getOverridesForText(lyrics),
        );
        analyzedTextRef.current = lyrics;
        setDocument(restored.document);
        setPreservedReadingCount(restored.restoredCount);
        setStatus("success");
      }
    } catch (error) {
      if (controllerRef.current === controller) {
        setErrorMessage(getAnalysisErrorMessage(error));
        setStatus("error");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  const handleLyricsChange = (value: string) => {
    setLyrics(value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const loadSample = () => {
    setTitle(SAMPLE_SONG_TITLE);
    setArtist(SAMPLE_SONG_ARTIST);
    setAlbum("");
    setLyrics(SAMPLE_LYRICS);
    setValidationError(null);
    resetResult();
  };

  const clearWorkspace = () => {
    setTitle("");
    setArtist("");
    setAlbum("");
    setLyrics("");
    setValidationError(null);
    resetResult();
  };

  const useSourceLyrics = (content: LyricsSourceContent) => {
    setTitle(content.title);
    setArtist(content.artist);
    setAlbum(content.album ?? "");
    setLyrics(content.lyrics_text);
    setValidationError(null);
    resetResult();
  };

  const openSharedDocument = useCallback(
    (sharedDocument: LyricsDocument) => {
      setTitle(sharedDocument.title ?? "");
      setArtist(sharedDocument.artist ?? "");
      setAlbum(sharedDocument.album ?? "");
      setLyrics(sharedDocument.original_text);
      analyzedTextRef.current = sharedDocument.original_text;
      readingContextRef.current = {
        key: getLyricsStorageKey(sharedDocument.original_text),
        overrides: collectReadingOverrides(sharedDocument),
      };
      setValidationError(null);
      setErrorMessage(null);
      setPreservedReadingCount(0);
      setDocument(sharedDocument);
      setStatus("success");
    },
    [],
  );

  useEffect(() => {
    if (!initialDocumentId) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const loadSavedDocument = async () => {
      await Promise.resolve();
      if (!active) {
        return;
      }
      setViewMode("reader");
      setIsLoadingSaved(true);
      setSavedLoadError(null);
      try {
        const saved = await getSavedDocument(
          initialDocumentId,
          controller.signal,
        );
        if (active) {
          openSharedDocument(saved.document);
          setIsLoadingSaved(false);
        }
      } catch (error) {
        if (active) {
          setSavedLoadError(
            error instanceof Error
              ? error.message
              : "打开已保存歌词失败。",
          );
          setIsLoadingSaved(false);
        }
      }
    };

    void loadSavedDocument();
    return () => {
      active = false;
      controller.abort();
    };
  }, [initialDocumentId, openSharedDocument]);

  const applyReadings = (
    lineId: string,
    readings: Record<string, string>,
  ) => {
    if (!document) {
      return;
    }

    const targetLine = document.lines.find((line) => line.id === lineId);
    if (!targetLine) {
      return;
    }

    const analyzedText = analyzedTextRef.current ?? lyrics;
    const overrides = { ...getOverridesForText(analyzedText) };

    for (const segment of targetLine.segments) {
      const reading = readings[segment.id]?.trim();
      if (!reading) {
        continue;
      }

      overrides[
        getReadingOverrideKey(
          targetLine.line_index,
          segment.segment_index,
          segment.surface,
        )
      ] = reading;
    }

    readingContextRef.current = {
      key: getLyricsStorageKey(analyzedText),
      overrides,
    };
    saveReadingOverrides(analyzedText, overrides);
    setDocument(applyReadingOverrides(document, overrides).document);
  };

  const clearCurrentReadingOverrides = async () => {
    const analyzedText = analyzedTextRef.current;
    if (!analyzedText) {
      return;
    }

    clearReadingOverrides(analyzedText);
    readingContextRef.current = {
      key: getLyricsStorageKey(analyzedText),
      overrides: {},
    };
    setPreservedReadingCount(0);
    await startAnalysis();
  };

  if (initialDocumentId && isLoadingSaved) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div>
          <span className="mx-auto block h-1 w-16 overflow-hidden rounded-full bg-line">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-brand" />
          </span>
          <p className="mt-4 text-sm text-muted">正在打开歌词…</p>
        </div>
      </div>
    );
  }

  if (initialDocumentId && savedLoadError) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-medium">无法打开这份歌词</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {savedLoadError}
          </p>
          <Link
            href="/library"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-xs font-medium text-white hover:bg-[#272727]"
          >
            返回歌词库
          </Link>
        </div>
      </div>
    );
  }

  if (initialDocumentId && viewMode === "reader" && document) {
    return (
      <SavedLyricsView
        document={document}
        onEdit={() => setViewMode("editor")}
      />
    );
  }

  return (
    <div className="space-y-5">
      {!initialDocumentId && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-8">歌词注音</h1>
            <p className="mt-1 text-sm text-muted">
              粘贴日语歌词，生成汉字假名与逐行罗马音，并保留原文排版。
            </p>
          </div>
        </div>
      )}

      {initialDocumentId && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setViewMode("reader")}
            className="text-xs font-medium text-muted transition hover:text-ink"
          >
            ← 返回歌词一览
          </button>
          <span className="text-xs text-muted">
            正在修改歌词库中的歌曲
          </span>
        </div>
      )}

      <DocumentSyncPanel
        document={document}
        initialDocumentId={initialDocumentId}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <LyricsInput
          title={title}
          artist={artist}
          album={album}
          lyrics={lyrics}
          isProcessing={status === "processing"}
          validationError={validationError}
          onTitleChange={setTitle}
          onArtistChange={setArtist}
          onAlbumChange={setAlbum}
          onLyricsChange={handleLyricsChange}
          onSubmit={() => void startAnalysis()}
          onLoadSample={loadSample}
          onClear={clearWorkspace}
          onUseSourceLyrics={useSourceLyrics}
        />
        <LyricsDisplay
          status={status}
          document={document}
          errorMessage={errorMessage}
          onRetry={() => void startAnalysis()}
          onReadingApply={applyReadings}
          preservedReadingCount={preservedReadingCount}
          onClearReadingOverrides={() => void clearCurrentReadingOverrides()}
        />
      </div>
    </div>
  );
}
