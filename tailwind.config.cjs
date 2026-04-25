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
          card: '#3A5C73',
          cardHover: '#406783',
          cardBorder: 'rgba(255,255,255,0.15)',
          cardAction: 'rgba(255,255,255,0.08)',
          cardActionHover: 'rgba(255,255,255,0.14)',
          gold: '#C8A96A',
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
        },
        celestial: {
          base: '#061A2D',
          deepBlue: '#08213A',
          panel: 'rgba(8, 33, 58, 0.82)',
          panelHover: 'rgba(15, 48, 78, 0.9)',
          gold: '#C89B5C',
          softGold: '#E0C58B',
          textMain: '#F4E8D0',
          textSub: '#B9C7D1',
          border: 'rgba(200, 155, 92, 0.3)',
          shadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)'
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(15, 23, 42, 0.08)",
        card: "0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
        celestial: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)"
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    }
  },
  plugins: []
};
