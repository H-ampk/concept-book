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
          bg: "#f8fbff",
          bgAlt: "#f2f8fc",
          section: "rgba(56, 189, 248, 0.06)",
          surface: "rgba(255, 255, 255, 0.82)",
          card: "#ffffff",
          cardHover: "#f8fbff",
          cardBorder: "rgba(125, 211, 252, 0.35)",
          cardAction: "rgba(224, 247, 255, 0.55)",
          cardActionHover: "rgba(186, 230, 253, 0.45)",
          gold: "#38bdf8",
          border: "rgba(125, 211, 252, 0.35)",
          textPrimary: "#1e293b",
          textSecondary: "#64748b",
          textMuted: "#94a3b8",
          textDisabled: "#cbd5e1",
          textOnDark: "#f8fafc",
          primary: "#e0f7ff",
          accent: "#bae6fd",
          sage: "#7dd3fc",
          blue: "#38bdf8",
          navy: "#f1f5f9",
          statusGreenBg: "rgba(125, 211, 252, 0.18)",
          statusGreenText: "#0284c7",
          overlay: "rgba(15, 23, 42, 0.34)"
        },
        celestial: {
          base: "#f8fbff",
          deepBlue: "#edf6fb",
          panel: "rgba(255, 255, 255, 0.82)",
          panelHover: "rgba(242, 248, 252, 0.94)",
          gold: "#38bdf8",
          softGold: "#64748b",
          textMain: "#1e293b",
          textSub: "rgba(100, 116, 139, 0.9)",
          border: "rgba(125, 211, 252, 0.35)",
          shadow:
            "0 12px 32px rgba(56, 189, 248, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          emerald: "#0ea5e9",
          danger: "#FF5F6D"
        },
        action: {
          DEFAULT: "#38bdf8",
          hover: "#7dd3fc",
          active: "#0ea5e9",
          text: "#1e293b",
          glow: "rgba(56, 189, 248, 0.2)"
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(15, 23, 42, 0.06)",
        card: "0 4px 20px rgba(56, 189, 248, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)",
        celestial:
          "0 8px 32px rgba(56, 189, 248, 0.12), 0 2px 12px rgba(15, 23, 42, 0.04)",
        mystic:
          "0 10px 30px rgba(56, 189, 248, 0.1), inset 0 0 14px rgba(125, 211, 252, 0.06)"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))"
      }
    }
  },
  plugins: []
};
