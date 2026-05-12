/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2D34",
        paper: "#F8FBFC",
        accent: "#5E737D",
        nordic: {
          bg: "#F8FBFC",
          bgAlt: "#F2F7F9",
          muted: "#EEF5F8",
          section: "rgba(110, 140, 155, 0.07)",
          surface: "rgba(255, 255, 255, 0.78)",
          card: "#FFFFFF",
          cardHover: "#F2F7F9",
          cardBorder: "rgba(110, 140, 155, 0.22)",
          cardAction: "rgba(90, 131, 151, 0.12)",
          cardActionHover: "rgba(90, 131, 151, 0.18)",
          gold: "#9EBFCC",
          border: "rgba(110, 140, 155, 0.22)",
          textPrimary: "#1F2D34",
          textSecondary: "#5E737D",
          textMuted: "#7D919A",
          textDisabled: "rgba(125, 145, 154, 0.65)",
          textOnDark: "#F7FBFD",
          primary: "#D8E8EE",
          accent: "#9EBFCC",
          sage: "#7D9DAD",
          blue: "#5A8397",
          navy: "rgba(79, 115, 131, 0.12)",
          statusGreenBg: "rgba(255, 255, 255, 0.16)",
          statusGreenText: "#F7FBFD",
          overlay: "rgba(45, 62, 72, 0.35)"
        },
        celestial: {
          base: "#F8FBFC",
          deepBlue: "#EEF5F8",
          panel: "rgba(255, 255, 255, 0.88)",
          panelHover: "rgba(255, 255, 255, 0.88)",
          gold: "#5A8397",
          softGold: "#5E737D",
          textMain: "#1F2D34",
          textSub: "rgba(94, 115, 125, 0.92)",
          border: "rgba(110, 140, 155, 0.22)",
          shadow:
            "0 10px 28px rgba(70, 95, 110, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.35)",
          emerald: "#446878",
          danger: "#FF5F6D",
          onCard: "#F7FBFD",
          onCardSub: "rgba(247, 251, 253, 0.9)",
          onCardMuted: "rgba(247, 251, 253, 0.75)"
        },
        action: {
          DEFAULT: "#5A8397",
          hover: "#4E7688",
          active: "#446878",
          text: "#F7FBFD",
          glow: "rgba(117, 165, 188, 0.28)"
        }
      },
      boxShadow: {
        quiet: "0 10px 28px rgba(70, 95, 110, 0.08)",
        card: "0 10px 28px rgba(70, 95, 110, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        celestial:
          "0 10px 28px rgba(70, 95, 110, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88), inset 0 0 0 1px rgba(255, 255, 255, 0.35)",
        mystic: "0 8px 22px rgba(70, 95, 110, 0.08), inset 0 0 12px rgba(158, 191, 204, 0.1)"
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
