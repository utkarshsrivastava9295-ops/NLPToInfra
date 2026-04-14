/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#070a12",
          900: "#0c1020",
          800: "#141a2e",
        },
        accent: {
          DEFAULT: "#5eead4",
          dim: "#2dd4bf",
          glow: "#99f6e4",
        },
        coral: "#fb7185",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(7,10,18,0.2), rgba(7,10,18,0.95)), radial-gradient(ellipse 80% 50% at 50% -20%, rgba(94,234,212,0.25), transparent)",
      },
      animation: {
        shimmer: "shimmer 2.2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
