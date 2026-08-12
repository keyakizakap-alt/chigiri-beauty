import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CHIGIRI Beauty",
  description:
    "スキンケア、ヘア、ボディ、メイク、ネイルを5人の美容コンシェルジュに相談。手持ち品の成分や違い、使い方まで確認できます。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/chigiri-app-icon.png",
    shortcut: "/chigiri-app-icon.png",
    apple: "/chigiri-app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preload" as="image" href="/chigiri-app-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
