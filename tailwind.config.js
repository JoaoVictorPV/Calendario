/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FDFBF7",
        foreground: "#292524", // Stone 800
        card: "#FFFFFF",
        "card-foreground": "#292524",
        primary: "#A7C957", // Sage Green as primary action color
        "primary-foreground": "#FFFFFF",
        secondary: "#E5E5E5", // Sand
        "secondary-foreground": "#292524",
        muted: "#F5F5F4", // Stone 100
        "muted-foreground": "#78716C", // Stone 500
        accent: "#C77DFF", // Lavender
        destructive: "#E07A5F", // Terracotta
        border: "#E5E5E5",
        input: "#F5F5F4",
        ring: "#A7C957",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
