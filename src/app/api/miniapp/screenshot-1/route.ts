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
          background: "#f3f0f3",
          fontFamily: "Arial, sans-serif",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: 980,
            height: 2400,
            borderRadius: 48,
            background: "#ffffff",
            padding: "56px",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          },
        },
        React.createElement("div", {
          style: {
            fontSize: 68,
            fontWeight: 800,
            color: "#151313",
          },
          children: "FairSplit",
        }),
        React.createElement("div", {
          style: {
            width: "100%",
            height: 190,
            borderRadius: 24,
            background: "#f8f7f8",
          },
        }),
        React.createElement("div", {
          style: {
            width: "100%",
            height: 310,
            borderRadius: 24,
            background: "#f8f7f8",
          },
        }),
        React.createElement("div", {
          style: {
            width: "100%",
            height: 310,
            borderRadius: 24,
            background: "#f8f7f8",
          },
        }),
        React.createElement("div", {
          style: {
            width: "100%",
            height: 310,
            borderRadius: 24,
            background: "#f8f7f8",
          },
        }),
        React.createElement("div", {
          style: {
            width: 370,
            height: 88,
            borderRadius: 20,
            background: "#f7b8ee",
            color: "#151313",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
          },
          children: "Create split",
        })
      )
    ),
    { width: 1284, height: 2778 }
  );
}
