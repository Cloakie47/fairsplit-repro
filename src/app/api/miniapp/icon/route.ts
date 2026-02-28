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
        },
      },
      React.createElement("div", {
        style: {
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: "#f7b8ee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#151313",
          fontSize: 170,
          fontWeight: 800,
          fontFamily: "Arial, sans-serif",
        },
        children: "FS",
      })
    ),
    { width: 1024, height: 1024 }
  );
}
