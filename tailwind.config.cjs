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
          bg: '#2D506E',
          section: 'rgba(255,255,255,0.10)',
          surface: 'rgba(243,247,250,0.92)',
          card: '#3A5F7A',
          cardHover: '#406783',
          cardBorder: 'rgba(255,255,255,0.15)',
          cardAction: 'rgba(255,255,255,0.08)',
          cardActionHover: 'rgba(255,255,255,0.14)',
          border: 'rgba(255,255,255,0.22)',
          textPrimary: '#1E2F3D',
          textSecondary: '#5B7086',
          textMuted: '#C9D8E3',
          textOnDark: '#F3F7FA',
          primary: '#25465F',
          accent: '#4A7C92',
          sage: '#5A8F7B',
          blue: '#4A7C92',
          navy: '#2D506E',
          statusGreenBg: '#D1E8DC',
          statusGreenText: '#2D5F42'
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
