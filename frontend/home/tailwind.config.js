/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: "#0f1320",
          neon: "#00ffff",
          ok: "#00ff00",
          info: "#0000ff"
        }
      },
      fontFamily: {
        montserrat: ['Montserrat', 'ui-sans-serif', 'system-ui']
      },
      boxShadow: {
        neon: "0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.35)"
      },
      animation: {
        'star-movement-bottom': 'star-movement-bottom linear infinite alternate',
        'star-movement-top': 'star-movement-top linear infinite alternate',
      },
      keyframes: {
        'star-movement-bottom': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(-100%, 0%)', opacity: '0' },
        },
        'star-movement-top': {
          '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
          '100%': { transform: 'translate(100%, 0%)', opacity: '0' },
        },
      }
    }
  },
  plugins: []
};