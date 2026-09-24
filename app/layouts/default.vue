<script setup lang="ts">
// Общий каркас витрины (T-14): иконки, фон, шапка, подвал и модалка корзины были
// продублированы в каждом HTML-мокапе — здесь это один layout по конвенции Nuxt.
</script>

<template>
  <div>
    <IconSprite />
    <BackgroundFx />
    <SiteHeader />

    <main class="wrap">
      <slot />
    </main>

    <SiteFooter />
    <CartModal />
  </div>
</template>
