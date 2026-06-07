import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlaytestPool",
  description: "Match indie developers with real playtesters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
