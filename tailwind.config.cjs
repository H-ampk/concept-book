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
          bg: '#E8F1EE',
          section: '#DCE8E3',
          surface: '#F7FAF9',
          border: '#C9D8D2',
          textPrimary: '#24343C',
          textSecondary: '#5A6F6A',
          sage: '#6FA87D',
          blue: '#4A7C92',
          navy: '#2C4F5C',
          statusGreenBg: '#D4E8DC',
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
