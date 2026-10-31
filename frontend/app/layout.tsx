import type { Metadata, Viewport } from "next";

import { AppUpdateProvider } from "@/components/AppUpdateProvider";
import { DisplaySettingsProvider } from "@/components/DisplaySettingsProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "KANA · 日语歌词智能注音",
  description: "保留原歌词排版，为日语汉字添加假名与逐行罗马音。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        <DisplaySettingsProvider>
          <AppUpdateProvider>{children}</AppUpdateProvider>
        </DisplaySettingsProvider>
      </body>
    </html>
  );
}
