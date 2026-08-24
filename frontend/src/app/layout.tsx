import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forex Analyzer — Deterministic Market Analysis",
  description:
    "Forex зах зээлийн ерөнхий дүн шинжилгээ: deterministic scoring engine BUY/SELL/WAIT signal гаргаж, AI зөвхөн тайлбарлана.",
};

/**
 * Root layout — Step 1: хамгийн энгийн бүтэц.
 * Step 2-оос QueryClientProvider, error.tsx / loading.tsx нэмэгдэнэ.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
