/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'DM Serif Display'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        slate: {
          950: "#0a0f1e",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
        amber: {
          400: "#fbbf24",
        },
        cyan: {
          400: "#22d3ee",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "pulse-slow": "pulse 3s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
