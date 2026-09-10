/** @type {import('tailwindcss').Config} */
const withAlpha = (cssVar) =>
  `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`;

module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: withAlpha("--text-primary"),
        paper: withAlpha("--paper-bg"),
        accent: withAlpha("--theme-button"),
        nordic: {
          bg: withAlpha("--bg-main"),
          bgAlt: withAlpha("--bg-main-soft"),
          muted: withAlpha("--bg-muted"),
          section: withAlpha("--border-soft"),
          surface: withAlpha("--glass-bg"),
          card: withAlpha("--bg-card"),
          cardHover: withAlpha("--glass-bg-hover"),
          cardBorder: withAlpha("--border-soft"),
          cardAction: withAlpha("--brand-primary-soft"),
          cardActionHover: withAlpha("--brand-primary-soft"),
          gold: withAlpha("--accent-line-blue"),
          border: withAlpha("--border-soft"),
          textPrimary: withAlpha("--text-primary"),
          textSecondary: withAlpha("--text-secondary"),
          textMuted: withAlpha("--text-muted"),
          textDisabled: withAlpha("--text-disabled"),
          textOnDark: withAlpha("--theme-header-text"),
          primary: withAlpha("--brand-primary-soft"),
          accent: withAlpha("--theme-button"),
          sage: withAlpha("--status-active"),
          blue: withAlpha("--theme-button"),
          navy: withAlpha("--border-soft"),
          statusGreenBg: withAlpha("--theme-header-text"),
          statusGreenText: withAlpha("--theme-header-text"),
          overlay: withAlpha("--overlay-bg")
        },
        celestial: {
          base: withAlpha("--bg-main"),
          deepBlue: withAlpha("--panel-bg-opaque"),
          panel: withAlpha("--glass-bg"),
          panelHover: withAlpha("--glass-bg-hover"),
          gold: withAlpha("--theme-button"),
          softGold: withAlpha("--theme-button-hover"),
          textMain: withAlpha("--text-primary"),
          textSub: withAlpha("--text-secondary"),
          border: withAlpha("--border-soft"),
          shadow: "var(--glass-shadow)",
          emerald: withAlpha("--theme-button-hover"),
          danger: withAlpha("--danger-red"),
          onCard: withAlpha("--text-on-card"),
          onCardSub: withAlpha("--text-on-card-sub"),
          onCardMuted: withAlpha("--text-on-card-muted")
        },
        action: {
          DEFAULT: withAlpha("--theme-button"),
          hover: withAlpha("--theme-button-hover"),
          active: withAlpha("--theme-button-active"),
          text: withAlpha("--theme-button-text"),
          glow: withAlpha("--focus-ring")
        }
      },
      boxShadow: {
        quiet: "var(--shadow-panel)",
        card: "var(--shadow-card)",
        celestial: "var(--glass-shadow)",
        mystic: "var(--shadow-card)"
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
