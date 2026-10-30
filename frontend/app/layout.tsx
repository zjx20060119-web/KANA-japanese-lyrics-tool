import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KANA · 日语歌词智能注音",
  description: "保留原歌词排版，为日语汉字添加假名与逐行罗马音。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
