import type { Config } from "tailwindcss";

/**
 * The Tech Founders List — design tokens
 * Source of truth: techfounderslist-brand-guide.md
 * Paper, Ink, Ledger-green, Brass palette — editorial/financial publishing.
 * No gradients, no drop shadows, hairline borders only.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F4EE",
        ink: {
          DEFAULT: "#14161C",
          60: "#5B5A52",
          30: "#B3B1C4",
        },
        "ledger-green": {
          DEFAULT: "#1F4D3A",
          900: "#0F2A1F",
        },
        "ledger-red": {
          DEFAULT: "#9A3324",
          900: "#5A1E15",
        },
        brass: {
          DEFAULT: "#A9822F",
          900: "#4A3105",
        },
        slate: {
          DEFAULT: "#4C5B73",
          900: "#1E2733",
        },
        "confirmed": "#EFEBE1",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      maxWidth: {
        content: "1120px",
      },
      borderWidth: {
        hairline: "0.5px",
      },
      borderColor: {
        hairline: "rgba(20, 22, 28, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
