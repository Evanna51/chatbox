/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'wechat-green': '#07c160',
        // 主题色系 - 使用 CSS 变量，可以根据主题动态变化
        'primary': {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)', 
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',  // 默认主色
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
        },
        'secondary': {
          50: 'rgb(var(--color-secondary-50) / <alpha-value>)',
          100: 'rgb(var(--color-secondary-100) / <alpha-value>)',
          200: 'rgb(var(--color-secondary-200) / <alpha-value>)',
          300: 'rgb(var(--color-secondary-300) / <alpha-value>)',
          400: 'rgb(var(--color-secondary-400) / <alpha-value>)',
          500: 'rgb(var(--color-secondary-500) / <alpha-value>)',  // 默认次色
          600: 'rgb(var(--color-secondary-600) / <alpha-value>)',
          700: 'rgb(var(--color-secondary-700) / <alpha-value>)',
          800: 'rgb(var(--color-secondary-800) / <alpha-value>)',
          900: 'rgb(var(--color-secondary-900) / <alpha-value>)',
        },
        // 清新颜色方案 - 浅色版
        'fresh-mint': '#00b894',      // 薄荷绿 - 主色调
        'fresh-sky': '#74b9ff',       // 天空蓝 - 次要色调
        'fresh-teal': '#00cec9',      // 翠绿色 - 成功色
        'fresh-orange': '#fdcb6e',    // 阳光橙 - 警告色
        'fresh-coral': '#e17055',     // 珊瑚红 - 错误色
        'fresh-lavender': '#a29bfe',  // 薰衣草紫 - 信息色
        'fresh-pink': '#ff7675',      // 樱花粉 - 新增
        // 清新颜色方案 - 深色版
        'fresh-mint-dark': '#4dd0c7',      // 深色薄荷绿
        'fresh-sky-dark': '#42a5f5',       // 深色天空蓝
        'fresh-teal-dark': '#66bb6a',      // 深色翠绿色
        'fresh-orange-dark': '#ffb74d',    // 深色阳光橙
        'fresh-coral-dark': '#ef5350',     // 深色珊瑚红
        'fresh-lavender-dark': '#ba68c8',  // 深色薰衣草紫
        'fresh-pink-dark': '#f06292',      // 深色樱花粉
      },
      spacing: {
        none: 'var(--chatbox-spacing-none)',
        '3xs': 'var(--chatbox-spacing-3xs)',
        xxs: 'var(--chatbox-spacing-xxs)',
        xs: 'var(--chatbox-spacing-xs)',
        sm: 'var(--chatbox-spacing-sm)',
        md: 'var(--chatbox-spacing-md)',
        lg: 'var(--chatbox-spacing-lg)',
        xl: 'var(--chatbox-spacing-xl)',
        xxl: 'var(--chatbox-spacing-xxl)',
      },
      borderRadius: {
        none: 'var(--chatbox-radius-none)',
        xs: 'var(--chatbox-radius-xs)',
        sm: 'var(--chatbox-radius-sm)',
        md: 'var(--chatbox-radius-md)',
        lg: 'var(--chatbox-radius-lg)',
        xl: 'var(--chatbox-radius-xl)',
        xxl: 'var(--chatbox-radius-xxl)',
      },
      animation: {
        'fade-in': 'fadeIn 1s ease-out',
        flash: 'flash 0.5s ease-in-out 2',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('tailwind-scrollbar')],
  corePlugins: {
    preflight: false,
  },
}
