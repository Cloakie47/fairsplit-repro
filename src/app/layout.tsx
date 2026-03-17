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
