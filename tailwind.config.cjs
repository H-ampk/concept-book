/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#24313A",
        paper: "#FFFDF8",
        accent: "#5E7E93",
        nordic: {
          bg: "#F5F0E8",
          bgAlt: "#FAF6EF",
          muted: "#EFE8DD",
          section: "rgba(128, 109, 86, 0.06)",
          surface: "rgba(255, 253, 248, 0.94)",
          card: "#FFFDF8",
          cardHover: "#FCF8F1",
          cardBorder: "rgba(128, 109, 86, 0.16)",
          cardAction: "rgba(220, 214, 207, 0.65)",
          cardActionHover: "rgba(220, 214, 207, 0.85)",
          gold: "#9AAEBA",
          border: "rgba(128, 109, 86, 0.16)",
          textPrimary: "#24313A",
          textSecondary: "#5F6D74",
          textMuted: "#7B7770",
          textDisabled: "rgba(110, 104, 96, 0.55)",
          textOnDark: "#F9FBFC",
          primary: "#DCD6CF",
          accent: "#5E7E93",
          sage: "#6C8AA0",
          blue: "#5E7E93",
          navy: "rgba(128, 109, 86, 0.1)",
          statusGreenBg: "rgba(255, 253, 248, 0.16)",
          statusGreenText: "#F9FBFC",
          overlay: "rgba(52, 58, 64, 0.38)"
        },
        celestial: {
          base: "#F5F0E8",
          deepBlue: "#FCF8F1",
          panel: "rgba(255, 253, 248, 0.96)",
          panelHover: "#FFFDF8",
          gold: "#5E7E93",
          softGold: "#516F82",
          textMain: "#24313A",
          textSub: "rgba(95, 109, 116, 0.92)",
          border: "rgba(128, 109, 86, 0.16)",
          shadow:
            "0 8px 22px rgba(88, 76, 62, 0.07), inset 0 1px 0 rgba(255, 253, 248, 0.8), inset 0 0 0 1px rgba(128, 109, 86, 0.06)",
          emerald: "#516F82",
          danger: "#E11D48",
          onCard: "#F9FBFC",
          onCardSub: "rgba(249, 251, 252, 0.92)",
          onCardMuted: "rgba(249, 251, 252, 0.78)"
        },
        action: {
          DEFAULT: "#5E7E93",
          hover: "#516F82",
          active: "#4A6272",
          text: "#F9FBFC",
          glow: "rgba(94, 126, 147, 0.18)"
        }
      },
      boxShadow: {
        quiet: "0 8px 22px rgba(88, 76, 62, 0.07)",
        card: "0 6px 18px rgba(88, 76, 62, 0.065), inset 0 1px 0 rgba(255, 253, 248, 0.88)",
        celestial:
          "0 8px 22px rgba(88, 76, 62, 0.07), inset 0 1px 0 rgba(255, 253, 248, 0.8), inset 0 0 0 1px rgba(128, 109, 86, 0.06)",
        mystic: "0 6px 18px rgba(88, 76, 62, 0.06), inset 0 0 0 1px rgba(128, 109, 86, 0.08)"
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
