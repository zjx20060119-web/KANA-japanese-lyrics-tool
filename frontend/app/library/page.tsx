import type { Metadata } from "next";

import LyricsLibrary from "@/components/LyricsLibrary";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "我的歌词库 · KANA",
  description: "保存和重新打开已生成的歌词注音结果。",
};

export default function LibraryPage() {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6">
        <LyricsLibrary />
      </div>
    </main>
  );
}
