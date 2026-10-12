/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './component/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ploop logo colors: navy eyes, robin-egg head, pink tile, rainbow arms.
      colors: {
        ink: '#0B1B3A',
        blush: { DEFAULT: '#FFF1F5', deep: '#FFE1EA' },
        lagoon: { DEFAULT: '#7FD6D0', deep: '#1F746F' },
        gray: {
          100: '#FFE9F0',
          200: '#F6D2DE',
          300: '#E4BFCC',
          400: '#8F7A8E',
          500: '#5A6179',
          600: '#434C67',
          700: '#2E3754',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        rainbow:
          'linear-gradient(90deg, #E84848 0 16.66%, #F08828 0 33.33%, #F0C030 0 50%, #38B868 0 66.66%, #3880F0 0 83.33%, #8858F0 0)',
      },
    },
  },
  plugins: [],
};
