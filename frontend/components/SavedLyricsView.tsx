"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import RomajiLine from "@/components/RomajiLine";
import RubyText from "@/components/RubyText";
import type { LyricsDocument } from "@/lib/types";

type SavedLyricsViewProps = {
  document: LyricsDocument;
  onEdit: () => void;
};

const ROMAJI_GAP = -8;
const ROW_GAP = 20;
const LYRIC_SIZE = 25;
const ROMAJI_SIZE = 13;
const ROW_PADDING = ROW_GAP / 2;

function getByline(document: LyricsDocument): string {
  const artist = document.artist?.trim();
  const album = document.album?.trim();

  if (artist && album) {
    return `${artist} - ${album}`;
  }
  return artist || album || "";
}

function getExportFileName(title: string | null): string {
  const base = (title || "未命名歌曲")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return `${base || "未命名歌曲"}-歌词注音.png`;
}

export default function SavedLyricsView({
  document,
  onEdit,
}: SavedLyricsViewProps) {
  const byline = getByline(document);
  const captureRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportScreenshot = async () => {
    const target = captureRef.current;
    if (!target || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      await window.document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(target, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
        style: {
          backgroundColor: "#ffffff",
          padding: "24px",
        },
        filter: (node) =>
          !(
            node instanceof HTMLElement &&
            node.dataset.exportIgnore === "true"
          ),
      });

      const link = window.document.createElement("a");
      link.href = dataUrl;
      link.download = getExportFileName(document.title);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "截图生成失败，请稍后重试。",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <article
      data-saved-lyrics-view
      className="mx-auto w-full max-w-3xl pb-16 pt-2 sm:pt-5"
    >
      <div ref={captureRef} className="bg-white">
        <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-japanese break-words text-3xl font-bold uppercase leading-[1.2] tracking-[-0.02em] sm:text-4xl">
              {document.title || "未命名歌曲"}
            </h1>
            {byline && (
              <p className="font-japanese mt-2 break-words text-sm leading-6 text-muted">
                {byline}
              </p>
            )}
          </div>

          <div
            data-export-ignore="true"
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            <Link
              href="/library"
              prefetch={false}
              className="flex h-10 items-center rounded-full px-3 text-xs font-medium text-muted transition hover:bg-surface hover:text-ink"
            >
              返回歌词库
            </Link>
            <button
              type="button"
              onClick={onEdit}
              className="font-sans h-10 rounded-full bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-hover"
            >
              修改歌词
            </button>
          </div>
        </header>

        <div className="mt-7">
          {document.lines.map((line) =>
            line.is_blank ? (
              <div key={line.id} className="h-6 sm:h-8" aria-hidden="true" />
            ) : (
              <div
                key={line.id}
                data-reader-line-index={line.line_index}
                style={{
                  paddingTop: ROW_PADDING,
                  paddingBottom: ROW_PADDING,
                }}
              >
                <div
                  style={{ fontSize: `${LYRIC_SIZE}px` }}
                  className="font-japanese break-words leading-[1.75] text-ink [overflow-wrap:anywhere]"
                >
                  <RubyText segments={line.segments} />
                </div>
                <div style={{ marginTop: `${ROMAJI_GAP}px` }}>
                  <RomajiLine
                    romaji={line.romaji}
                    showMarker={false}
                    variant="reader"
                    fontSize={ROMAJI_SIZE}
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <section
        data-export-ignore="true"
        className="mt-10 flex flex-col items-center gap-3 border-t border-line pt-6"
      >
        <button
          type="button"
          onClick={() => void exportScreenshot()}
          disabled={isExporting}
          className="font-sans flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-55"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2.5v7" />
            <path d="m5 6.5 3 3 3-3" />
            <path d="M3 12.5h10" />
          </svg>
          {isExporting ? "正在生成截图…" : "导出歌词截图"}
        </button>
        <p className="text-center text-xs leading-5 text-muted">
          将当前歌名、歌手/专辑和全部歌词保存为 PNG 图片
        </p>
        {exportError && (
          <p
            role="alert"
            className="rounded-md border border-brand/20 bg-[#fff5f5] px-3 py-2 text-xs text-brand"
          >
            {exportError}
          </p>
        )}
      </section>
    </article>
  );
}
