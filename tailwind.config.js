const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jetbrains)', ...fontFamily.sans],
      },
      duration: {
        '500': '500ms',
      },
      transitionProperty: {
        'height': 'height',
        'opacity': 'opacity',
      },
      colors: {
        'background': 'var(--background)',
        'foreground': 'var(--foreground)',
        'card': 'var(--card)',
        'muted-foreground': 'var(--muted-foreground)',
        'border': 'var(--border)',
      },
      borderRadius: {
        'lg': 'var(--radius)',
        'md': 'calc(var(--radius) - 2px)',
        'sm': 'calc(var(--radius) - 4px)',
      },
      animation: {
        'fade-out': 'fadeOut 500ms ease-in-out forwards',
        'fade-in': 'fadeIn 500ms ease-in-out forwards',
      },
    }
  },
  plugins: [],
}
