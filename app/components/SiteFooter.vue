<script setup lang="ts">
// Подвал — общий для всех страниц. Документы (T-25, фаза 4 плана) теперь реальные страницы;
// данные ИП внутри них — заглушка до заполнения владельцем (см. /requisites).
</script>

<template>
  <footer class="site">
    <div class="wrap">
      <div class="foot-grid">
        <div>
          <h4>О магазине</h4>
          <p>
            Официальный магазин сервера wise. Покупка привязывается к нику в момент оплаты.
            Если выдача не пришла за 10 минут — напишите в поддержку.
          </p>
        </div>
        <div>
          <h4>Разделы</h4>
          <ul>
            <li><NuxtLink to="/roles">Роли</NuxtLink></li>
            <li><NuxtLink to="/crates">Кейсы</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h4>Документы</h4>
          <ul>
            <li><NuxtLink to="/offer">Публичная оферта</NuxtLink></li>
            <li><NuxtLink to="/returns">Политика возврата</NuxtLink></li>
            <li><NuxtLink to="/privacy">Обработка данных</NuxtLink></li>
            <li><NuxtLink to="/requisites">Реквизиты</NuxtLink></li>
          </ul>
        </div>
      </div>
      <div class="legal">
        <span>ИП «———», БИН ———————— · Казахстан</span>
        <span>wisepvp.net</span>
      </div>
    </div>
  </footer>
</template>
