// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],

  // Витрина — обычный SSR (T-14): каталог должен рендериться на сервере ради SEO и
  // быстрого первого пейнта, в отличие от админки (site/admin), которая нарочно SPA.
  ssr: true,

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      // Единственный внешний хост, который допускает CSP артефактов/продакшена — Google
      // Fonts, шрифты те же, что в дизайн-макете (Rubik/Onest/JetBrains Mono).
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Rubik:wght@500;600;700;800&family=Onest:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap',
        },
      ],
    },
  },

  // cssPath, а не css: [...] — иначе @nuxtjs/tailwindcss не находит файл с @tailwind по
  // своему пути по умолчанию и подключает собственный, tailwind едет в страницу дважды
  // (см. тот же приём и комментарий в site/admin/nuxt.config.ts).
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  // T-34: заголовки безопасности на каждый ответ. HSTS выставляет сам Render на своём домене.
  //
  // connect-src — только свой origin: браузер ходит в /api/* этого же Nuxt-сервера, а тот уже
  // в EasyDonate. Переход на страницу оплаты — обычная навигация, CSP её не ограничивает.
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': [
          "default-src 'self'",
          // 'unsafe-inline': Nuxt SSR встраивает данные страницы (window.__NUXT__) инлайновым
          // <script> с разным содержимым на каждой странице — без него гидратация падает.
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https://cdn.easydonate.ru",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    },
  },

  // Приватные ключи — только на сервере Nuxt, в клиентский бандл не попадают.
  // Задаются переменными окружения NUXT_EASYDONATE_SHOP_KEY, NUXT_EASYDONATE_SERVER_ID,
  // NUXT_PUBLIC_SITE_URL, NUXT_PUBLIC_KZT_PER_RUB (см. .env.example).
  runtimeConfig: {
    easydonateShopKey: '',
    easydonateServerId: '142066',
    public: {
      siteUrl: 'https://wisepvp.net',
      // Сколько тенге в рубле — только для подписи «≈ N ₸» под ценой. Платёж идёт в рублях.
      kztPerRub: 5.3,
    },
  },
})
