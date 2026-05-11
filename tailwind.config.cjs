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
          bg: "#f1f4f3",
          bgAlt: "#edf1ef",
          section: "rgba(77, 124, 115, 0.08)",
          surface: "rgba(255, 255, 255, 0.42)",
          card: "#f3f5f2",
          cardHover: "#edf1ef",
          cardBorder: "rgba(77, 124, 115, 0.24)",
          cardAction: "rgba(255, 255, 255, 0.48)",
          cardActionHover: "rgba(255, 255, 255, 0.58)",
          gold: "#4d7c73",
          border: "rgba(77, 124, 115, 0.24)",
          textPrimary: "#1f2f2c",
          textSecondary: "#526963",
          textMuted: "#7b8f89",
          textDisabled: "#9db0aa",
          textOnDark: "#f3f5f2",
          primary: "#e7ecea",
          accent: "#6b9b92",
          sage: "#5f8f87",
          blue: "#4d7c73",
          navy: "#e7ecea",
          statusGreenBg: "rgba(77, 124, 115, 0.16)",
          statusGreenText: "#2f5f57",
          overlay: "rgba(31, 47, 44, 0.36)"
        },
        celestial: {
          base: "#f1f4f3",
          deepBlue: "#e7ecea",
          panel: "rgba(255, 255, 255, 0.42)",
          panelHover: "rgba(255, 255, 255, 0.58)",
          gold: "#4d7c73",
          softGold: "#526963",
          textMain: "#1f2f2c",
          textSub: "rgba(82, 105, 99, 0.92)",
          border: "rgba(77, 124, 115, 0.24)",
          shadow:
            "0 18px 48px rgba(47, 95, 87, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78), inset 0 -1px 0 rgba(77, 124, 115, 0.08)",
          emerald: "#2f5f57",
          danger: "#FF5F6D"
        },
        action: {
          DEFAULT: "#4d7c73",
          hover: "#5f8f87",
          active: "#2f5f57",
          text: "#1f2f2c",
          glow: "rgba(47, 95, 87, 0.18)"
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(47, 95, 87, 0.08)",
        card: "0 4px 20px rgba(47, 95, 87, 0.1), 0 1px 3px rgba(31, 47, 44, 0.05)",
        celestial:
          "0 18px 48px rgba(47, 95, 87, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78), inset 0 -1px 0 rgba(77, 124, 115, 0.08)",
        mystic:
          "0 10px 30px rgba(47, 95, 87, 0.12), inset 0 0 14px rgba(77, 124, 115, 0.06)"
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
