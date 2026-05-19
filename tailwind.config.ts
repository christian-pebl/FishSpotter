import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // PEBL brand teal scale. 500 is the on-dark accent; 600 is the on-light "primary".
        teal: {
          50: "#DEF2F1", // light-teal brand surface
          100: "#DEF2F1",
          400: "#59c8c3", // hover-on-dark
          500: "#3AAFA9", // accent / on-dark button bg
          600: "#2B7A78", // primary / on-light text
          700: "#1F5F5D", // primary-strong / eyebrow
          800: "#2b9d97", // hover-on-light
        },
        // PEBL navy scale. 900 is the brand foreground; 800 is the immersive modal surface.
        navy: {
          800: "#0F1D22", // modal
          900: "#17252A", // foreground / dark surface
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#eef9f8", // distinct from teal.50 by design; consolidation deferred to Sprint 5
        },
        danger: {
          DEFAULT: "#c83a3a",
          onDark: "#fda4a4",
        },
        warn: {
          DEFAULT: "#d97706",
          onDark: "#fbd38d",
        },
      },
      borderRadius: {
        card: "24px",
        hero: "28px",
        modal: "16px",
      },
      boxShadow: {
        panel: "0 8px 22px rgba(0,0,0,0.45), 0 0 0 3px rgba(58,175,169,0.18)",
        card: "0 18px 40px rgba(23,37,42,0.08)",
        chip: "0 1px 2px rgba(23,37,42,0.06)",
        glow: "0 0 6px rgba(58,175,169,0.6)",
        menu: "0 10px 36px rgba(0,0,0,0.55)",
        drawer: "8px 0 30px rgba(0,0,0,0.5)",
      },
      fontFamily: {
        brand: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      fontSize: {
        display: ["3rem", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        h1: ["2.25rem", { lineHeight: "1.15", fontWeight: "700" }],
        h2: ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        h3: ["1.375rem", { lineHeight: "1.3", fontWeight: "600" }],
        eyebrow: ["0.75rem", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
