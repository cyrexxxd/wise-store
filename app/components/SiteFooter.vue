<script setup lang="ts">
// Подвал — общий для всех страниц: документы, контакты и реквизиты продавца (app/data/seller.ts) —
// Robokassa проверяет их наличие на сайте при активации магазина.
import { PENDING, SELLER, sellerTitle } from '~/data/seller'
</script>

<template>
  <footer class="site">
    <div class="wrap">
      <div class="foot-grid">
        <div>
          <h4>О магазине</h4>
          <p>
            Официальный магазин {{ SELLER.brand }}. Оплата в тенге через Robokassa, выдача на ник автоматически.
            Email: {{ SELLER.email ?? PENDING }}<template v-if="SELLER.phone"> · тел.: {{ SELLER.phone }}</template> · поддержка {{ SELLER.supportHours }}.
          </p>
        </div>
        <div>
          <h4>Разделы</h4>
          <ul>
            <li><NuxtLink to="/roles">Роли</NuxtLink></li>
            <li><NuxtLink to="/currency">Когти</NuxtLink></li>
            <li><NuxtLink to="/crates">Кейсы</NuxtLink></li>
            <li><NuxtLink to="/cosmetics">Косметика</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h4>Документы</h4>
          <ul>
            <li><NuxtLink to="/offer">Публичная оферта</NuxtLink></li>
            <li><NuxtLink to="/returns">Политика возврата</NuxtLink></li>
            <li><NuxtLink to="/privacy">Обработка данных</NuxtLink></li>
            <li><NuxtLink to="/requisites">Реквизиты</NuxtLink></li>
            <li><NuxtLink to="/contacts">Контакты</NuxtLink></li>
          </ul>
        </div>
      </div>
      <div class="legal">
        <span>{{ sellerTitle() }}<template v-if="SELLER.iin"> · ИИН/БИН {{ SELLER.iin }}</template> · {{ SELLER.address ?? 'Казахстан' }}</span>
        <span>wisepvp.net</span>
      </div>
    </div>
  </footer>
</template>
