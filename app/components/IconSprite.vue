<script setup lang="ts">
// Единственная копия SVG-спрайта на всё приложение — раньше он дублировался в <head>
// каждого HTML-мокапа (design-mockup.html, crates.html, ...). Живёт в layout, рендерится
// один раз, иконки переиспользуются через <use href="#ic-...">.
</script>

<template>
  <svg class="icons" aria-hidden="true">
    <symbol id="ic-back" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" /></symbol>
    <symbol id="ic-cart" viewBox="0 0 24 24">
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.4 11.5A2 2 0 0 0 9.4 17h7.2a2 2 0 0 0 2-1.6L20 7H6" />
    </symbol>
    <symbol id="ic-copy" viewBox="0 0 24 24">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M6 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2" />
    </symbol>
    <symbol id="ic-check" viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19.5 7" /></symbol>
    <symbol id="ic-warn" viewBox="0 0 24 24">
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </symbol>
  </svg>
</template>
