import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

const MINIAPP_HOME_URL = "https://fairsplit-repro.vercel.app";

export const metadata: Metadata = {
  title: "FairSplit — Bill Splitting",
  description: "Split bills with on-chain settlement using USDC on Base",
  // Declared here rather than as app/icon.svg: public/icon.svg already exists
  // for the miniapp routes, and the two paths collide
  // ("A conflicting public file and page file was found for path /icon.svg").
  // Without this, every page logged a 404 for /favicon.ico.
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  other: {
    "base:app_id": "6979d24e2dbd4b464042adc0",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} font-grotesk dot-grid`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
