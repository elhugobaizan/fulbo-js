/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores inspirados en el fútbol argentino
        pitch: {
          50: '#f0fdf4',
          500: '#22c55e',
          900: '#14532d',
        },
        sky: {
          celeste: '#74ACDF', // celeste argentina
        }
      },
      fontFamily: {
        display: ['system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
