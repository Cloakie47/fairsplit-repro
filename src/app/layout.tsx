import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const MINIAPP_HOME_URL = "https://fairsplit-repro.vercel.app";
const MINIAPP_EMBED = JSON.stringify({
  version: "next",
  imageUrl: `${MINIAPP_HOME_URL}/miniapp/landing-preview.png`,
  button: {
    title: "Open FairSplit",
    action: {
      type: "launch_miniapp",
      name: "Launch FairSplit",
      url: MINIAPP_HOME_URL,
    },
  },
});

export const metadata: Metadata = {
  title: "FairSplit — Bill Splitting",
  description: "Split bills with on-chain settlement",
  other: {
    "base:app_id": "69a53df76d5151991e105996",
    "fc:miniapp": MINIAPP_EMBED,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
