/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        dossier: {
          bg: '#F5F6FA',
          panel: '#ffffff',
          border: '#e2e8f0',
          hover: '#f1f5f9',
          accent: '#3B69EB',
          'accent-light': '#4F7CFF',
          text: '#1e293b',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
