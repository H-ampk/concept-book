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
          bg: '#E1EAF0',
          section: '#D2DEE6',
          surface: '#F6F9FB',
          border: '#B6C6D1',
          textPrimary: '#243746',
          textSecondary: '#536774',
          primary: '#2D506E',
          accent: '#25465F',
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
