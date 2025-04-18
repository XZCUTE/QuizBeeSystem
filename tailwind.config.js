/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#03256C",
          light: "#2541B2",
        },
        secondary: "#1768AC",
        accent: "#06BEE1",
        white: "#FFFFFF",
      },
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
      },
      animation: {
        'pulse-slow': 'pulse 2s infinite',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'pop': 'pop 0.3s ease forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'trophy': 'trophy 3s ease-in-out 1s forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-float': 'pulse-float 8s ease-in-out infinite',
        'pulse-float-reverse': 'pulse-float-reverse 9s ease-in-out infinite',
        'pulse-float-slow': 'pulse-float-slow 12s ease-in-out infinite',
        'shimmer-slow': 'shimmer-slow 3s infinite',
        'wave': 'wave 15s ease-in-out infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.95)' },
          '40%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        trophy: {
          '0%': { transform: 'scale(1) rotate(0deg)' },
          '10%': { transform: 'scale(1.1) rotate(-2deg)' },
          '20%': { transform: 'scale(1.1) rotate(2deg)' },
          '30%': { transform: 'scale(1.1) rotate(-2deg)' },
          '40%': { transform: 'scale(1.1) rotate(2deg)' },
          '50%': { transform: 'scale(1.1) rotate(-2deg)' },
          '60%': { transform: 'scale(1.1) rotate(2deg)' },
          '70%': { transform: 'scale(1.1) rotate(-2deg)' },
          '80%, 100%': { transform: 'scale(1) rotate(0deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-float': {
          '0%, 100%': { transform: 'scale(1) translateY(0px)', opacity: '0.2' },
          '50%': { transform: 'scale(1.05) translateY(-15px)', opacity: '0.3' },
        },
        'pulse-float-reverse': {
          '0%, 100%': { transform: 'scale(1) translateY(0px)', opacity: '0.2' },
          '50%': { transform: 'scale(1.05) translateY(15px)', opacity: '0.3' },
        },
        'pulse-float-slow': {
          '0%, 100%': { transform: 'scale(1) translateY(0px) rotate(0deg)', opacity: '0.1' },
          '50%': { transform: 'scale(1.1) translateY(-10px) rotate(5deg)', opacity: '0.2' },
        },
        'shimmer-slow': {
          '0%': { transform: 'translateX(-150%)' },
          '100%': { transform: 'translateX(150%)' },
        },
        wave: {
          '0%, 100%': { 
            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
            transform: 'translateX(-50%) rotate(0deg) translateY(10px)' 
          },
          '50%': { 
            borderRadius: '70% 30% 30% 70% / 70% 70% 30% 30%',
            transform: 'translateX(-30%) rotate(2deg) translateY(5px)' 
          },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #03256C, #2541B2)',
        'gradient-secondary': 'linear-gradient(135deg, #1768AC, #06BEE1)',
      },
      boxShadow: {
        'glow': '0 0 15px #06BEE1',
      },
    },
  },
  plugins: [],
}
