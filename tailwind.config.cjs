/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#24313A",
        paper: "#FFFDFA",
        accent: "#5E7E93",
        nordic: {
          bg: "#F6F2EC",
          bgAlt: "#FBF8F4",
          muted: "#F2ECE4",
          section: "rgba(91, 115, 133, 0.06)",
          surface: "rgba(255, 253, 250, 0.92)",
          card: "#FFFDFA",
          cardHover: "#FCFAF7",
          cardBorder: "rgba(91, 115, 133, 0.16)",
          cardAction: "rgba(214, 225, 232, 0.55)",
          cardActionHover: "rgba(214, 225, 232, 0.72)",
          gold: "#9AAEBA",
          border: "rgba(91, 115, 133, 0.16)",
          textPrimary: "#24313A",
          textSecondary: "#5F6D74",
          textMuted: "#7B878C",
          textDisabled: "rgba(123, 135, 140, 0.58)",
          textOnDark: "#F9FBFC",
          primary: "#D6E1E8",
          accent: "#5E7E93",
          sage: "#6C8AA0",
          blue: "#5E7E93",
          navy: "rgba(91, 115, 133, 0.12)",
          statusGreenBg: "rgba(255, 253, 250, 0.16)",
          statusGreenText: "#F9FBFC",
          overlay: "rgba(52, 58, 64, 0.38)"
        },
        celestial: {
          base: "#F6F2EC",
          deepBlue: "#FCFAF7",
          panel: "rgba(255, 253, 250, 0.95)",
          panelHover: "#FFFDFA",
          gold: "#5E7E93",
          softGold: "#516F82",
          textMain: "#24313A",
          textSub: "rgba(95, 109, 116, 0.92)",
          border: "rgba(91, 115, 133, 0.16)",
          shadow:
            "0 8px 24px rgba(75, 88, 98, 0.08), inset 0 1px 0 rgba(255, 253, 250, 0.75), inset 0 0 0 1px rgba(91, 115, 133, 0.08)",
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
          glow: "rgba(94, 126, 147, 0.2)"
        }
      },
      boxShadow: {
        quiet: "0 8px 24px rgba(75, 88, 98, 0.08)",
        card: "0 6px 18px rgba(80, 90, 98, 0.06), inset 0 1px 0 rgba(255, 253, 250, 0.85)",
        celestial:
          "0 8px 24px rgba(75, 88, 98, 0.08), inset 0 1px 0 rgba(255, 253, 250, 0.75), inset 0 0 0 1px rgba(91, 115, 133, 0.08)",
        mystic: "0 6px 18px rgba(80, 90, 98, 0.06), inset 0 0 0 1px rgba(154, 174, 186, 0.12)"
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
