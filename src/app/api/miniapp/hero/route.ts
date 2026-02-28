import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(135deg, #0b0b0b 0%, #1d1a1d 100%)",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        },
      },
      React.createElement("div", {
        style: {
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: "-1px",
          color: "#f7b8ee",
        },
        children: "FairSplit",
      }),
      React.createElement("div", {
        style: {
          marginTop: 16,
          fontSize: 40,
          color: "#f2ebf1",
        },
        children: "Split bills and settle with USDC",
      })
    ),
    { width: 1200, height: 630 }
  );
}
