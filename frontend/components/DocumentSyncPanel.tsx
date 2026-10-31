"use client";

import { useEffect, useState } from "react";

import {
  listSavedDocuments,
  saveLyricsDocument,
} from "@/lib/localLibrary";
import type { LyricsDocument } from "@/lib/types";

type DocumentSyncPanelProps = {
  document: LyricsDocument | null;
  initialDocumentId?: string | null;
};

function SyncIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 8h11l-3-3M19 16H8l3 3" />
    </svg>
  );
}

export default function DocumentSyncPanel({
  document,
  initialDocumentId = null,
}: DocumentSyncPanelProps) {
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(
    initialDocumentId,
  );
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    listSavedDocuments({ signal: controller.signal })
      .then((response) => {
        if (active) {
          setLibraryCount(response.documents.length);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "连接歌词库失败。",
          );
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const save = async () => {
    if (!document) {
      setMessage("请先完成一次注音，再保存到歌词库。");
      return;
    }

    setIsBusy(true);
    setMessage("");
    try {
      const saved = await saveLyricsDocument(
        document,
        savedDocumentId,
      );
      setSavedDocumentId(saved.summary.id);
      setLibraryCount((current) => current ?? 1);
      setMessage(
        `已保存 · 版本 ${saved.summary.revision} · ${saved.summary.confirmed_count} 处确认读音`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存歌词失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-3 border-y border-line bg-canvas py-4">
      <div className="flex min-w-0 items-center gap-2 text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-surface">
          <SyncIcon />
        </span>
        <div>
          <h2 className="text-sm font-medium">我的歌词库</h2>
          <p className="text-[11px] text-muted">
            {libraryCount === null
              ? "保存后无需重复分析"
              : `已连接 · ${libraryCount} 首歌曲`}
          </p>
        </div>
      </div>

      <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => void save()}
          disabled={isBusy || !document}
          className="h-10 w-full rounded-full bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {savedDocumentId ? "保存当前修改" : "保存当前结果"}
        </button>
      </div>

      {message && (
        <p className="w-full text-xs leading-5 text-muted" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
