import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        htb: {
          background: "#030712",
          surface: "#0B1324",
          surfaceLight: "#111C33",
          primary: "#7CFC00",
          primaryMuted: "#55D48A",
          primaryDark: "#1FAD66",
          accent: "#00F0FF",
          border: "#1F2A44",
          text: {
            DEFAULT: "#EFF6FF",
            muted: "#7AA0B4",
            subtle: "#4C6475",
          },
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(124, 252, 0, 0.5)",
        inset: "inset 0 0 0 1px rgba(124, 252, 0, 0.08)",
      },
      backgroundImage: {
        "grid-holo":
          "radial-gradient(circle at top left, rgba(124,252,0,0.12), transparent 55%), radial-gradient(circle at 80% 20%, rgba(0,240,255,0.14), transparent 60%), linear-gradient(135deg, rgba(17, 24, 39, 0.8) 0%, rgba(3, 7, 18, 0.95) 60%)",
      },
      dropShadow: {
        neon: "0 0 15px rgba(124, 252, 0, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
