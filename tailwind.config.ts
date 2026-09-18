import type { Config } from 'tailwindcss'

// Витрина не строится из Tailwind-утилит покомпонентно — она портирует уже готовый
// дизайн-макет (store.css, T-13) один в один, поэтому основной вид даёт store.css.
// Tailwind здесь даёт preflight + доступ к утилитам там, где это быстрее, чем писать
// точечный CSS в новых компонентах (например, разметка карточек в Vue-шаблонах).
// Токены продублированы из store.css :root, чтобы Tailwind-утилиты (bg-accent, text-ink
// и т.п.) могли переиспользовать ту же палитру без рассинхронизации значений руками.
export default <Partial<Config>>{
  darkMode: 'class',
  // store.css уже даёт полный сброс (* { box-sizing: border-box }, явные margin/line-height
  // на body и т.д. — см. файл). Preflight Tailwind сбрасывает те же самые свойства на тех же
  // селекторах (body, h1..h6, ...) с той же специфичностью; при валидном порядке файла
  // (@import обязан идти первым правилом, значит raньше @tailwind base) preflight грузился бы
  // ПОСЛЕ store.css и перебивал бы её своими значениями. Проще и надёжнее выключить preflight,
  // чем держать в уме порядок каскада между двумя source of truth для одних и тех же тегов.
  corePlugins: {
    preflight: false,
  },
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rubik', 'Trebuchet MS', 'sans-serif'],
        body: ['Onest', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: '#121018',
        'bg-2': '#17141E',
        surface: '#1C1926',
        'surface-2': '#242030',
        line: '#2C2838',
        'line-hi': '#3A3448',
        ink: '#F1EEF7',
        'ink-2': '#B7B0C6',
        muted: '#837C93',
        accent: '#8C6DFF',
        'accent-hi': '#A992FF',
        'accent-ink': '#161225',
      },
    },
  },
}
