"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import SongCover from "@/components/SongCover";
import {
  deleteSavedDocument,
  duplicateSavedDocument,
  listSavedDocuments,
  updateSavedDocumentMetadata,
} from "@/lib/localLibrary";
import type { SavedDocumentSummary } from "@/lib/types";

function formatDate(value: string | null): string {
  if (!value) {
    return "尚未打开";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}

export default function LyricsLibrary() {
  const [documents, setDocuments] = useState<SavedDocumentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");

  const loadLibrary = async (options?: {
    query?: string;
    favoritesOnly?: boolean;
  }) => {
    const response = await listSavedDocuments({
      query: options?.query ?? query,
      favoritesOnly: options?.favoritesOnly ?? favoritesOnly,
    });
    setDocuments(response.documents);
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    listSavedDocuments({ signal: controller.signal })
      .then((response) => {
        if (active) {
          setDocuments(response.documents);
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
      })
      .finally(() => {
        if (active) {
          setIsLoaded(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const search = async () => {
    setIsBusy(true);
    setMessage("");
    try {
      await loadLibrary({ query, favoritesOnly });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "搜索歌词库失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const toggleFavorite = async (item: SavedDocumentSummary) => {
    setIsBusy(true);
    try {
      const updated = await updateSavedDocumentMetadata(item.id, {
        title: item.title,
        artist: item.artist,
        album: item.album,
        isFavorite: !item.is_favorite,
      });
      setDocuments((current) =>
        current.map((saved) =>
          saved.id === item.id ? updated.summary : saved,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "更新收藏失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const beginRename = (item: SavedDocumentSummary) => {
    setEditingId(item.id);
    setEditTitle(item.title ?? "");
    setEditArtist(item.artist ?? "");
    setEditAlbum(item.album ?? "");
  };

  const saveRename = async (item: SavedDocumentSummary) => {
    setIsBusy(true);
    try {
      const updated = await updateSavedDocumentMetadata(item.id, {
        title: editTitle.trim() || null,
        artist: editArtist.trim() || null,
        album: editAlbum.trim() || null,
        isFavorite: item.is_favorite,
      });
      setDocuments((current) =>
        current.map((saved) =>
          saved.id === item.id ? updated.summary : saved,
        ),
      );
      setEditingId(null);
      setMessage("歌曲信息已更新。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "重命名失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const duplicate = async (item: SavedDocumentSummary) => {
    setIsBusy(true);
    try {
      const duplicated = await duplicateSavedDocument(item.id);
      await loadLibrary();
      setMessage(`已复制为《${duplicated.summary.title}》。`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "复制歌词失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async (item: SavedDocumentSummary) => {
    if (!window.confirm(`确定删除《${item.title || "未命名歌曲"}》吗？`)) {
      return;
    }
    setIsBusy(true);
    try {
      await deleteSavedDocument(item.id);
      setDocuments((current) =>
        current.filter((saved) => saved.id !== item.id),
      );
      setMessage("歌曲已从歌词库删除。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "删除歌词失败。",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      <section className="border-b border-line pb-5 sm:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold leading-8">我的歌词库</h1>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <form
            className="flex w-full min-w-0 sm:max-w-2xl sm:flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索歌名、歌手或歌词"
              className="h-10 min-w-0 flex-1 rounded-l-full border border-line bg-canvas px-4 text-sm outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={isBusy}
              aria-label="搜索"
              className="grid h-10 w-14 place-items-center rounded-r-full border border-l-0 border-line bg-surface text-muted hover:bg-surface-strong disabled:cursor-wait disabled:opacity-50"
            >
              <SearchIcon />
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              const next = !favoritesOnly;
              setFavoritesOnly(next);
              setIsBusy(true);
              loadLibrary({ query, favoritesOnly: next })
                .catch((error: unknown) =>
                  setMessage(
                    error instanceof Error ? error.message : "筛选失败。",
                  ),
                )
                .finally(() => setIsBusy(false));
            }}
            className={`h-10 rounded-full px-4 text-sm font-medium ${
              favoritesOnly
                ? "bg-ink text-white"
                : "bg-surface text-ink hover:bg-surface-strong"
            }`}
          >
            {favoritesOnly ? "显示全部" : "只看收藏"}
          </button>
        </div>

        {message && (
          <p role="status" className="mt-3 text-xs leading-5 text-muted">
            {message}
          </p>
        )}
      </section>

      <section>
        {!isLoaded ? (
          <div className="grid min-h-64 place-items-center bg-surface px-5 text-center text-sm text-muted">
            正在读取歌词库…
          </div>
        ) : documents.length === 0 ? (
            <div className="grid min-h-64 place-items-center bg-surface px-5 text-center text-sm text-muted">
              还没有保存歌曲。完成注音后，从工作台保存到歌词库。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {documents.map((item) => (
                <article
                  key={item.id}
                  data-document-id={item.id}
                  className="group min-w-0"
                >
                  <div className="relative">
                    <Link
                      href={`/?open=${encodeURIComponent(item.id)}`}
                      aria-label={`打开 ${item.title || "未命名歌曲"}`}
                    >
                      <SongCover
                        title={item.title}
                        artist={item.artist}
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(item)}
                      aria-label={item.is_favorite ? "取消收藏" : "收藏"}
                      className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 backdrop-blur-sm transition hover:bg-black/75 ${
                        item.is_favorite ? "text-brand" : "text-white"
                      }`}
                    >
                      <StarIcon filled={item.is_favorite} />
                    </button>
                  </div>

                  {editingId === item.id ? (
                    <div className="mt-3 space-y-2">
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="歌曲名称"
                        className="font-japanese h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink"
                      />
                      <input
                        value={editArtist}
                        onChange={(event) => setEditArtist(event.target.value)}
                        placeholder="歌手"
                        className="font-japanese h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink"
                      />
                      <input
                        value={editAlbum}
                        onChange={(event) => setEditAlbum(event.target.value)}
                        placeholder="专辑（选填）"
                        className="font-japanese h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm outline-none focus:border-ink"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveRename(item)}
                          disabled={isBusy}
                          className="h-8 rounded-full bg-ink px-3 text-xs text-white disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-full bg-surface px-3 text-xs text-ink"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-japanese mt-3 line-clamp-2 text-sm font-medium leading-5 text-ink">
                        <Link
                          href={`/?open=${encodeURIComponent(item.id)}`}
                          className="hover:underline"
                        >
                          {item.title || "未命名歌曲"}
                        </Link>
                      </h2>
                      <p className="font-japanese mt-1 truncate text-xs text-muted">
                        {item.artist || "未知歌手"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-muted">
                        <span>
                          版本 {item.revision} · {item.confirmed_count} 处确认
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap tabular-nums">
                          {formatDate(item.last_opened_at || item.updated_at)}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
                        <Link
                          href={`/?open=${encodeURIComponent(item.id)}`}
                          className="font-medium text-link hover:underline"
                        >
                          打开歌词
                        </Link>
                        <button
                          type="button"
                          onClick={() => beginRename(item)}
                          className="text-muted hover:text-ink"
                        >
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => void duplicate(item)}
                          disabled={isBusy}
                          className="text-muted hover:text-ink disabled:opacity-50"
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(item)}
                          disabled={isBusy}
                          className="text-muted hover:text-brand disabled:opacity-50"
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}
