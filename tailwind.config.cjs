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
          bg: '#0b1e2d',
          section: 'rgba(212,175,55,0.08)',
          surface: 'rgba(15, 42, 64, 0.88)',
          card: '#10263A',
          cardHover: '#132f44',
          cardBorder: 'rgba(212,175,55,0.22)',
          cardAction: 'rgba(212,175,55,0.12)',
          cardActionHover: 'rgba(212,175,55,0.18)',
          gold: '#d4af37',
          border: 'rgba(212,175,55,0.23)',
          textPrimary: '#e6d3a3',
          textSecondary: '#c4b38e',
          textMuted: '#9d8c70',
          textOnDark: '#e6d3a3',
          primary: '#122635',
          accent: '#27475c',
          sage: '#5A8F7B',
          blue: '#4A7C92',
          navy: '#10263a',
          statusGreenBg: '#D1E8DC',
          statusGreenText: '#2D5F42'
        },
        celestial: {
          base: '#0b1e2d',
          deepBlue: '#0f2a40',
          panel: 'rgba(11, 30, 45, 0.88)',
          panelHover: 'rgba(15, 42, 64, 0.92)',
          gold: '#d4af37',
          softGold: '#f1d67a',
          textMain: '#e6d3a3',
          textSub: 'rgba(230,211,163,0.78)',
          border: 'rgba(212,175,55,0.6)',
          shadow: '0 12px 32px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.05)'
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(15, 23, 42, 0.08)",
        card: "0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
        celestial: "0 8px 32px rgba(0, 0, 0, 0.28), 0 2px 10px rgba(212,175,55,0.15)",
        mystic: "0 10px 30px rgba(212,175,55,0.16), inset 0 0 14px rgba(212,175,55,0.08)"
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    }
  },
  plugins: []
};
