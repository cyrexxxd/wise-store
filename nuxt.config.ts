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
  // в Postgres. Переход на страницу оплаты Robokassa — обычная навигация, CSP её не ограничивает.
  routeRules: {
    // раздел титулов переехал в каталог косметики
    '/titles': { redirect: { to: '/cosmetics?tab=title', statusCode: 301 } },
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
          "img-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    },
  },

  // Приватные ключи — только на сервере Nuxt, в клиентский бандл не попадают.
  // Задаются переменными окружения (см. .env.example): NUXT_ROBOKASSA_LOGIN/PASSWORD1/PASSWORD2/HASH/TEST,
  // NUXT_DATABASE_URL, NUXT_DELIVERY_SERVER_TOKEN, NUXT_PUBLIC_SITE_URL, NUXT_PUBLIC_KZT_PER_RUB.
  runtimeConfig: {
    robokassa: {
      login: '',
      password1: '',
      password2: '',
      // алгоритм подписи из технических настроек магазина: md5 | sha256
      hash: 'sha256',
      // 1 — тестовый режим (IsTest=1, тестовые пароли), 0 — боевые платежи
      test: '1',
    },
    // ApiPay.kz — оплата через Kaspi (счёт по номеру телефона). Ключ и секрет вебхука — из кабинета ApiPay.
    apipay: {
      apiKey: '',
      webhookSecret: '',
      // 1 — песочница: счета не настоящие, заказы тестовые и без выдачи; 0 — боевой режим (после одобрения анкеты)
      sandbox: '1',
      // только для локального стенда (мок ApiPay); на Render не задавать
      baseUrl: '',
    },
    databaseUrl: '',
    // токен плагина WiseDelivery (X-Server-Token), не короче 32 символов
    deliveryServerToken: '',
    // 1 — выдавать и тестовые (IsTest) заказы: ТОЛЬКО локальный стенд, на Render не задавать
    deliveryAllowTest: '',
    public: {
      siteUrl: 'https://wisepvp.net',
      // Сколько тенге в рубле — только для подсказки «≈ N ₽» под ценой; платёж идёт в тенге.
      kztPerRub: 5.3,
    },
  },
})
