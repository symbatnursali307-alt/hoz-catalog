import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        "accent-dark": "var(--accent-dark)",
        dark: "var(--dark)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
