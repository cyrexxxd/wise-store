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

  // T-34: заголовки безопасности на каждый ответ. HSTS сюда намеренно не входит — она имеет
  // смысл только на реальном домене с сертификатом (блокер №2 плана), на localhost/http это
  // просто мёртвая строка.
  //
  // connect-src перечисляет ТОЛЬКО дев-порт бэкенда (localhost:5169) — при выкладке на
  // реальный домен эту строку и origin в фигурных скобках ниже нужно поменять на настоящий
  // адрес API, иначе CSP молча заблокирует все запросы каталога/заказов/входа в проде.
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': [
          "default-src 'self'",
          // 'unsafe-inline' здесь — не небрежность: Nuxt SSR встраивает данные страницы
          // (window.__NUXT__) инлайновым <script> на каждой странице, с разным содержимым —
          // ни один статический hash в CSP под это не подходит, а per-request nonce нужен
          // отдельный модуль (nuxt-security), которого в проекте нет. Без 'unsafe-inline'
          // гидратация падает намертво (проверено: "Cannot create proxy with a non-object").
          // CSP всё равно блокирует загрузку скриптов с чужих доменов и инлайн через <img onerror>
          // и т.п. в атрибутах — просто не защищает от инлайн-<script>-инъекции конкретно.
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          // MinIO — оттуда отдаются картинки товаров (Minio:PublicBaseUrl на бэкенде).
          // На реальном хостинге поменять localhost:9000 на настоящий адрес MinIO/CDN.
          "img-src 'self' data: http://localhost:9000",
          "connect-src 'self' http://localhost:5169",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    },
  },

  // Публичный, read-only и анонимный каталог (см. PublicCatalogController.cs у бэкенда) —
  // браузер ходит туда напрямую, никакого секрета в этом URL нет, поэтому он в public,
  // а не в приватном runtimeConfig. Дефолт — локальный dev-порт бэкенда (как в site/admin);
  // переопределяется NUXT_PUBLIC_CATALOG_API_BASE.
  runtimeConfig: {
    public: {
      catalogApiBase: 'http://localhost:5169/api/catalog',
      // POST /api/orders — тоже анонимный (см. PublicOrdersController.cs), тот же принцип,
      // что у catalogApiBase выше. Переопределяется NUXT_PUBLIC_ORDERS_API_BASE.
      ordersApiBase: 'http://localhost:5169/api/orders',
      // T-17: вход по нику (см. PlayerAuthController.cs). В отличие от каталога/заказов эти
      // запросы идут с credentials:'include' (httpOnly cookie сессии игрока) — публичный URL,
      // секрета тут так же нет. Переопределяется NUXT_PUBLIC_AUTH_API_BASE.
      authApiBase: 'http://localhost:5169/api/auth/player',
    },
  },
})
