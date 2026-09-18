import { defineConfig } from 'vitest/config'

// Только plain-TS unit-тесты (чистые функции из app/utils и app/composables) — по образцу
// site/admin/vitest.config.ts. Компонентные тесты потребовали бы @nuxt/test-utils с
// отдельным nuxt-окружением — не настроено, витрина пока не даёт для этого нетривиальной логики.
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~': new URL('./app', import.meta.url).pathname,
    },
  },
})
