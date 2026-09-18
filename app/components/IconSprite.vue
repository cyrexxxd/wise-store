<script setup lang="ts">
// Единственная копия SVG-спрайта на всё приложение — раньше он дублировался в <head>
// каждого HTML-мокапа (design-mockup.html, crates.html, ...). Живёт в layout, рендерится
// один раз, иконки переиспользуются через <use href="#ic-...">.
</script>

<template>
  <svg class="icons" aria-hidden="true">
    <symbol id="ic-crate" viewBox="0 0 24 24">
      <path d="M3 9h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="M3 9l2-5h14l2 5" />
      <circle cx="12" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </symbol>
    <symbol id="ic-title" viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5 7 21l5-3 5 3-2-7.5" />
    </symbol>
    <symbol id="ic-hat" viewBox="0 0 24 24">
      <path d="M12 3 4 17h16L12 3Z" />
      <path d="M4 17h16" />
    </symbol>
    <symbol id="ic-wings" viewBox="0 0 24 24">
      <path d="M12 12c-3-6-9-7-9-3 0 4 5 6 9 7" />
      <path d="M12 12c3-6 9-7 9-3 0 4-5 6-9 7" />
    </symbol>
    <symbol id="ic-sword" viewBox="0 0 24 24">
      <path d="M20.5 3.5 8 16l-3 5-2-2 5-3L20.5 3.5Z" />
      <path d="M15 8l3 3" />
    </symbol>
    <symbol id="ic-pet" viewBox="0 0 24 24">
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="6.3" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <path d="M7 13c0-2.5 2.2-4 5-4s5 1.5 5 4-2.5 5-5 5-5-2.5-5-5Z" />
    </symbol>
    <symbol id="ic-gem" viewBox="0 0 24 24">
      <path d="M12 3 4 9l8 12 8-12-8-6Z" />
      <path d="M4 9h16M8 9 12 3l4 6M9 9l3 12M15 9l-3 12" />
    </symbol>
    <symbol id="ic-shield" viewBox="0 0 24 24">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </symbol>
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
