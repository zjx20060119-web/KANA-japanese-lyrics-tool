import { Suspense } from "react";

import LyricsWorkspace from "@/components/LyricsWorkspace";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1500px] px-3 pb-8 pt-5 sm:px-5 lg:px-6">
        <Suspense
          fallback={
            <div className="rounded-xl border border-line bg-canvas p-8 text-center text-sm text-muted">
              正在加载歌词工作台…
            </div>
          }
        >
          <LyricsWorkspace />
        </Suspense>
      </div>
    </main>
  );
}
