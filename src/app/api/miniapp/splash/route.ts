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
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0b",
          color: "#f7b8ee",
          fontSize: 140,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
          letterSpacing: "-2px",
        },
      },
      "FairSplit"
    ),
    { width: 1200, height: 1200 }
  );
}
