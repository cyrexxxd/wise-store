<script setup lang="ts">
// Когти — как «Gold» у Hypixel: пакеты с растущей горкой, бонус и бейдж на выгодном; ниже — на что тратить.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'
import { crates, shopPrices } from '~/utils/cosmetics'
import { approxRub, formatKzt, formatPrice } from '~/utils/formatPrice'

useSeoMeta({
  title: 'Когти',
  description: 'Когти — валюта сервера CATIERS: ключи кейсов косметики и титулов, косметика навсегда. Цены в тенге.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Currency)
const { kztPerRub } = useRuntimeConfig().public
const { buy, added } = useBuy()
const uses = [
  { icon: 'key_cosmetic', title: 'Ключ кейса косметики', price: crates.find((c) => c.key === 'cosmetic')?.keyPrice ?? 75 },
  { icon: 'key_title', title: 'Ключ кейса титулов', price: crates.find((c) => c.key === 'title')?.keyPrice ?? 75 },
  { icon: 'hat/cowboy', title: 'Косметика навсегда', price: shopPrices.COMMON, from: true },
]
</script>

<template>
  <div>
    <section>
      <BackLink />
      <div class="sec-head tone-claws">
        <h1>Когти</h1>
        <p>Валюта сервера. Зачисляются на ник сразу после оплаты, а если ты не в сети — при следующем входе.</p>
      </div>

      <p v-if="error" class="grid-empty">Не получилось загрузить каталог. Попробуйте обновить страницу.</p>
      <div v-else-if="!pending" class="pack-grid">
        <article v-for="p in products" :key="p.slug" class="pack tone-claws" :class="{ featured: p.badge }">
          <span v-if="p.badge" class="pack-badge">{{ p.badge }}</span>
          <ItemIcon class="pack-ico" :icon="p.icon ?? 'claws_1'" :size="140" />
          <h3>{{ formatPrice(p.amount ?? 0) }} <span>Когтей</span></h3>
          <p class="pack-bonus" :class="{ none: !p.bonus }">{{ p.bonus ? `+${p.bonus} бонусом` : 'без бонуса' }}</p>
          <div class="pack-price"><b>{{ formatKzt(p.price) }}</b><i>{{ approxRub(p.price, kztPerRub) }}</i></div>
          <button class="btn btn-tone" @click="buy(p, true)">
            <svg><use href="#ic-cart" /></svg>{{ added === p.slug ? 'Добавлено' : 'Купить' }}
          </button>
        </article>
      </div>
    </section>

    <section>
      <div class="sec-head"><h2>На что тратить Когти</h2><p>Всё покупается в игре через <code>/cos</code>.</p></div>
      <div class="uses">
        <div v-for="u in uses" :key="u.title" class="use">
          <ItemIcon :icon="u.icon" :size="72" />
          <div><b>{{ u.title }}</b><span>{{ u.from ? 'от ' : '' }}{{ u.price }} Когтей</span></div>
        </div>
      </div>
    </section>
  </div>
</template>
