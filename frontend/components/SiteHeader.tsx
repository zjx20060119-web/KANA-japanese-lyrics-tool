"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function WorkbenchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 5.5h6v6H4zM14 5.5h6v6h-6zM4 14.5h6v4H4zM14 14.5h6v4h-6z" />
    </svg>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const isLibrary = pathname === "/library";

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-line bg-canvas">
      <div className="mx-auto flex h-full max-w-[1500px] items-center gap-3 px-3 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="font-japanese grid h-8 w-8 place-items-center rounded-md bg-brand text-lg font-normal text-white">
            歌
          </span>
          <span>
            <span className="block text-base font-bold leading-5">KANA</span>
            <span className="hidden text-[11px] leading-4 text-muted sm:block">
              日语歌词注音
            </span>
          </span>
        </Link>

        <nav
          aria-label="主导航"
          className="ml-2 flex items-center gap-1 sm:ml-6"
        >
          <Link
            href="/"
            className={`flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium transition ${
              isLibrary
                ? "text-muted hover:bg-surface hover:text-ink"
                : "bg-ink text-white"
            }`}
          >
            <WorkbenchIcon />
            <span className="hidden sm:inline">注音工作台</span>
          </Link>
          <Link
            href="/library"
            prefetch={false}
            className={`flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium transition ${
              isLibrary
                ? "bg-ink text-white"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <LibraryIcon />
            <span className="hidden sm:inline">我的歌词库</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-canvas px-3 text-xs text-muted"
            title="所有注音和歌词库数据都在本机处理"
          >
            <span className="h-2 w-2 rounded-full bg-success" />
            本地模式
          </span>
          <span
            aria-hidden="true"
            className="hidden h-8 w-8 place-items-center rounded-full bg-surface text-xs font-medium text-muted sm:grid"
          >
            K
          </span>
        </div>
      </div>
    </header>
  );
}

