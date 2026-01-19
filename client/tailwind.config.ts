import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f172a",
          muted: "#111827",
          accent: "#0d9488",
        },
        emerald: {
          950: "#022c22",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
      boxShadow: {
        glow: "0 0 25px 4px rgba(16,185,129,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
