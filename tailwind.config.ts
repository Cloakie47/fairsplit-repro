import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-bg": "#FFFFF8",
        "brand-cream": "#FFFDE8",
        "brand-yellow": "#D4F5A2",
        "brand-red": "#E8000D",
        "brand-black": "#0A0A0A",
        "brand-ink": "#1A1A18",
        "brand-muted": "#6A6A68",
        "brand-green": "#16a34a",
      },
      fontFamily: {
        grotesk: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      boxShadow: {
        brutal: "4px 4px 0px #0A0A0A",
        "brutal-lg": "6px 6px 0px #0A0A0A",
        "brutal-xl": "8px 8px 0px #0A0A0A",
      },
      keyframes: {
        "marquee-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "toast-in": {
          from: { transform: "translateY(20px) rotate(1deg)", opacity: "0" },
          to: { transform: "translateY(0) rotate(0deg)", opacity: "1" },
        },
        "toast-out": {
          from: { transform: "translateY(0)", opacity: "1" },
          to: { transform: "translateY(-16px)", opacity: "0" },
        },
        "word-in": {
          from: { opacity: "0", transform: "translateY(30px) rotate(2deg)" },
          to: { opacity: "1", transform: "translateY(0) rotate(0deg)" },
        },
        "progress-bar": {
          from: { transform: "scaleX(1)" },
          to: { transform: "scaleX(0)" },
        },
        "smack-in": {
          "0%": { opacity: "0", transform: "scale(0.8) rotate(-3deg)" },
          "60%": { transform: "scale(1.05) rotate(1deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "chain-flash": {
          "0%, 100%": { backgroundColor: "#FFFDE8" },
          "50%": { backgroundColor: "#FFF4A3" },
        },
      },
      animation: {
        marquee: "marquee-scroll 30s linear infinite",
        ticker: "ticker 22s linear infinite",
        "toast-in": "toast-in 0.35s cubic-bezier(0.34,1.4,0.64,1) forwards",
        "toast-out": "toast-out 0.3s ease-in forwards",
        "word-in": "word-in 0.5s cubic-bezier(0.34,1.3,0.64,1) forwards",
        "progress-bar": "progress-bar 3.5s linear forwards",
        "smack-in": "smack-in 0.4s 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-up": "fade-up 0.5s ease both",
        "chain-flash": "chain-flash 0.4s ease both",
      },
      fontSize: {
        label: ["10px", { lineHeight: "14px", letterSpacing: "0.1em" }],
        body: ["14px", { lineHeight: "20px" }],
        "card-title": ["20px", { lineHeight: "26px" }],
        "page-title": ["40px", { lineHeight: "44px" }],
      },
    },
  },
  plugins: [],
};

export default config;
