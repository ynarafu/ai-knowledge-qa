import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Knowledge Q&A",
  description:
    "資料を取り込み、根拠（出典）付きで答えるRAGチャット。Ollama / Claude / デモの3バックエンド対応。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
