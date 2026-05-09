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
          bg: "#020403",
          bgAlt: "#040807",
          section: "rgba(77, 255, 154, 0.06)",
          surface: "rgba(7, 17, 13, 0.92)",
          card: "#0B1712",
          cardHover: "#0e1f18",
          cardBorder: "rgba(77, 255, 154, 0.22)",
          cardAction: "rgba(77, 255, 154, 0.1)",
          cardActionHover: "rgba(77, 255, 154, 0.16)",
          gold: "#4DFF9A",
          border: "rgba(77, 255, 154, 0.28)",
          textPrimary: "#E7FFE8",
          textSecondary: "#A8CBB2",
          textMuted: "#6F8D78",
          textDisabled: "#405448",
          textOnDark: "#E7FFE8",
          primary: "#0F3D2E",
          accent: "#164a3a",
          sage: "#3d6b58",
          blue: "#2d5c48",
          navy: "#030A07",
          statusGreenBg: "rgba(77, 255, 154, 0.12)",
          statusGreenText: "#4DFF9A",
          overlay: "rgba(2, 8, 5, 0.86)"
        },
        celestial: {
          base: "#020403",
          deepBlue: "#030A07",
          panel: "rgba(7, 17, 13, 0.94)",
          panelHover: "rgba(11, 23, 18, 0.94)",
          gold: "#4DFF9A",
          softGold: "#A8CBB2",
          textMain: "#E7FFE8",
          textSub: "rgba(168, 203, 178, 0.88)",
          border: "rgba(77, 255, 154, 0.28)",
          shadow:
            "0 12px 32px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(77, 255, 154, 0.05)",
          emerald: "#1EDC7A",
          danger: "#FF5F6D"
        },
        action: {
          DEFAULT: "#FF9B3D",
          hover: "#FFB15F",
          active: "#E87820",
          text: "#120804",
          glow: "rgba(255, 155, 61, 0.24)"
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(0, 0, 0, 0.3)",
        card: "0 4px 20px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.15)",
        celestial:
          "0 8px 32px rgba(0, 0, 0, 0.38), 0 2px 12px rgba(77, 255, 154, 0.12)",
        mystic:
          "0 10px 30px rgba(77, 255, 154, 0.1), inset 0 0 14px rgba(77, 255, 154, 0.06)"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))"
      }
    }
  },
  plugins: []
};
