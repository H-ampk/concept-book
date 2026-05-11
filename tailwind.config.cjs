/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
        accent: "#334155",
        nordic: {
          bg: "#e6eae9",
          bgAlt: "#dde3e1",
          muted: "#d3d8d7",
          section: "rgba(73, 109, 102, 0.1)",
          surface: "rgba(230, 234, 233, 0.78)",
          card: "#496d66",
          cardHover: "#527a72",
          cardBorder: "rgba(255, 255, 255, 0.24)",
          cardAction: "rgba(255, 255, 255, 0.14)",
          cardActionHover: "rgba(255, 255, 255, 0.22)",
          gold: "#6b8f87",
          border: "rgba(73, 109, 102, 0.28)",
          textPrimary: "#1f2f2c",
          textSecondary: "#526963",
          textMuted: "#7b8f89",
          textDisabled: "#9db0aa",
          textOnDark: "#ffffff",
          primary: "#dde3e1",
          accent: "#8fb6ad",
          sage: "#6b8f87",
          blue: "#496d66",
          navy: "#d3d8d7",
          statusGreenBg: "rgba(255, 255, 255, 0.12)",
          statusGreenText: "#ffffff",
          overlay: "rgba(24, 40, 38, 0.45)"
        },
        celestial: {
          base: "#e6eae9",
          deepBlue: "#dde3e1",
          panel: "rgba(230, 234, 233, 0.72)",
          panelHover: "rgba(255, 255, 255, 0.35)",
          gold: "#496d66",
          softGold: "#3d524e",
          textMain: "#1f2f2c",
          textSub: "rgba(61, 82, 78, 0.92)",
          border: "rgba(73, 109, 102, 0.26)",
          shadow:
            "0 12px 36px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(255, 255, 255, 0.1)",
          emerald: "#2f5750",
          danger: "#FF5F6D",
          onCard: "#ffffff",
          onCardSub: "rgba(255, 255, 255, 0.88)",
          onCardMuted: "rgba(255, 255, 255, 0.72)"
        },
        action: {
          DEFAULT: "#496d66",
          hover: "#5a8279",
          active: "#2f5750",
          text: "#ffffff",
          glow: "rgba(143, 182, 173, 0.32)"
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(31, 63, 58, 0.12)",
        card: "0 18px 42px rgba(31, 63, 58, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.45)",
        celestial:
          "0 12px 36px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.58), inset 0 -1px 0 rgba(255, 255, 255, 0.12)",
        mystic:
          "0 10px 28px rgba(31, 63, 58, 0.2), inset 0 0 12px rgba(143, 182, 173, 0.12)"
      },
      borderRadius: {
        "3xl": "14px"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))"
      }
    }
  },
  plugins: []
};
