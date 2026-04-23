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
          bg: '#EEF3F1',
          surface: '#FCFDFB',
          border: '#D7E0DC',
          textPrimary: '#23313B',
          textSecondary: '#5F6E78',
          sage: '#7FA08D',
          blue: '#6E8FA8',
          navy: '#304554',
          statusGreenBg: '#DDF1E4',
          statusGreenText: '#386A4F'
        }
      },
      boxShadow: {
        quiet: "0 3px 10px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
