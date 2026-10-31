"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import WorkbenchSettings from "@/components/WorkbenchSettings";

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
  const normalizedPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const isLibrary = normalizedPath === "/library";

  return (
    <header className="sticky top-0 z-40 h-[calc(3.5rem+env(safe-area-inset-top))] border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="app-gutter mx-auto flex h-14 max-w-[1500px] items-center gap-2 sm:gap-3">
        <Link
          href="/"
          prefetch={false}
          aria-label="KANA 首页"
          className="flex shrink-0 items-center gap-2.5"
        >
          <span className="font-japanese grid h-8 w-8 place-items-center rounded-md bg-brand text-lg font-normal text-white">
            歌
          </span>
          <span className="hidden min-[380px]:block">
            <span className="block text-base font-bold leading-5">KANA</span>
            <span className="hidden text-[11px] leading-4 text-muted sm:block">
              日语歌词注音
            </span>
          </span>
        </Link>

        <nav
          aria-label="主导航"
          className="ml-1 flex min-w-0 items-center gap-0.5 sm:ml-6 sm:gap-1"
        >
          <Link
            href="/"
            prefetch={false}
            aria-current={isLibrary ? undefined : "page"}
            className={`flex h-9 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition sm:gap-2 sm:px-3 ${
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
            aria-current={isLibrary ? "page" : undefined}
            className={`flex h-9 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition sm:gap-2 sm:px-3 ${
              isLibrary
                ? "bg-ink text-white"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <LibraryIcon />
            <span className="hidden sm:inline">我的歌词库</span>
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <WorkbenchSettings />
        </div>
      </div>
    </header>
  );
}

