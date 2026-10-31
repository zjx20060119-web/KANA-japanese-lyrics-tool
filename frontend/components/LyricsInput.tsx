import type { FormEvent } from "react";

import LyricsSourceSearch from "@/components/LyricsSourceSearch";
import type { LyricsSourceContent } from "@/lib/types";

type LyricsInputProps = {
  title: string;
  artist: string;
  album: string;
  lyrics: string;
  isProcessing: boolean;
  validationError: string | null;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onAlbumChange: (value: string) => void;
  onLyricsChange: (value: string) => void;
  onSubmit: () => void;
  onLoadSample: () => void;
  onClear: () => void;
  onUseSourceLyrics: (content: LyricsSourceContent) => void;
};

const FIELD_CLASS =
  "h-10 w-full rounded-md border border-transparent bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-muted hover:bg-surface-strong focus:border-ink focus:bg-canvas disabled:cursor-wait disabled:opacity-60";

export default function LyricsInput({
  title,
  artist,
  album,
  lyrics,
  isProcessing,
  validationError,
  onTitleChange,
  onArtistChange,
  onAlbumChange,
  onLyricsChange,
  onSubmit,
  onLoadSample,
  onClear,
  onUseSourceLyrics,
}: LyricsInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section
      aria-labelledby="input-heading"
      className="min-w-0 rounded-xl border border-line bg-canvas p-4 sm:p-5"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="input-heading" className="text-xl font-medium leading-7">
          输入歌词
        </h2>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={isProcessing}
            className="h-9 rounded-full border border-line px-3 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-wait disabled:opacity-55 sm:px-4"
          >
            载入示例
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isProcessing}
            className="h-9 rounded-full border border-line px-3 text-xs font-medium text-muted transition hover:bg-surface hover:text-ink disabled:cursor-wait disabled:opacity-55 sm:px-4"
          >
            清空
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={isProcessing} className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                歌曲名称
              </span>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                autoComplete="off"
                className={`${FIELD_CLASS} font-japanese`}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                歌手
              </span>
              <input
                type="text"
                name="artist"
                value={artist}
                onChange={(event) => onArtistChange(event.target.value)}
                autoComplete="off"
                className={`${FIELD_CLASS} font-japanese`}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                专辑
              </span>
              <input
                type="text"
                name="album"
                value={album}
                onChange={(event) => onAlbumChange(event.target.value)}
                autoComplete="off"
                className={`${FIELD_CLASS} font-japanese`}
              />
            </label>
          </div>

          <LyricsSourceSearch
            title={title}
            artist={artist}
            disabled={isProcessing}
            onUseLyrics={onUseSourceLyrics}
          />

          <label htmlFor="lyrics-textarea" className="mt-5 block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
              歌词原文
              <span className="font-normal text-muted">必填 · 保留换行</span>
            </span>
            <textarea
              id="lyrics-textarea"
              name="lyrics"
              rows={10}
              value={lyrics}
              onChange={(event) => onLyricsChange(event.target.value)}
              placeholder={"在这里粘贴日语歌词…\n\n夜空に歌う\n静かな風が街を包む"}
              aria-required="true"
              aria-invalid={validationError ? "true" : "false"}
              aria-describedby={
                validationError ? "lyrics-validation-error" : undefined
              }
              className={`${FIELD_CLASS} h-auto min-h-52 resize-y py-3 leading-7`}
            />
          </label>

          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
            <span>支持多行文本与空行</span>
            <span>{lyrics.length} 字符</span>
          </div>
        </fieldset>

        <div
          id="lyrics-validation-error"
          aria-live="polite"
          className="mt-3 min-h-5"
        >
          {validationError && (
            <p
              role="alert"
              className="rounded-md border border-brand/20 bg-[#fff5f5] px-3 py-2 text-xs text-brand"
            >
              {validationError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isProcessing}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-55"
        >
          {isProcessing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              正在注音…
            </>
          ) : (
            <>
              开始注音
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10" />
                <path d="m9 4 4 4-4 4" />
              </svg>
            </>
          )}
        </button>

      </form>
    </section>
  );
}
