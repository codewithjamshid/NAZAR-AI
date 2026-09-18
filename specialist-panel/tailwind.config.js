/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zone: {
          red: "#dc2626",
          yellow: "#d97706",
          green: "#16a34a",
        },
      },
      keyframes: {
        "zone-pulse": {
          "0%, 100%": { backgroundColor: "rgba(220, 38, 38, 0.10)" },
          "50%": { backgroundColor: "rgba(220, 38, 38, 0.30)" },
        },
      },
      animation: {
        "zone-pulse": "zone-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
