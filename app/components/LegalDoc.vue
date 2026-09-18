<script setup lang="ts">
// Общий каркас для четырёх документов T-25 (оферта/возврат/данные/реквизиты) — один раз
// определённая типографика для длинного текста, а не Tailwind-утилиты в каждом абзаце.
defineProps<{ title: string; updated: string }>()
</script>

<template>
  <section class="legal">
    <BackLink />
    <div class="sec-head">
      <h1>{{ title }}</h1>
      <p>Действует с {{ updated }}</p>
    </div>

    <div class="legal-doc">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.legal-doc {
  max-width: 74ch;
}
.legal-doc :deep(h2) {
  font-family: var(--f-display);
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--ink);
  margin: 32px 0 12px;
}
.legal-doc :deep(h2:first-child) {
  margin-top: 0;
}
.legal-doc :deep(p) {
  color: var(--ink-2);
  font-size: 0.92rem;
  line-height: 1.7;
  margin: 0 0 12px;
}
.legal-doc :deep(ul) {
  margin: 0 0 12px;
  padding-left: 20px;
  color: var(--ink-2);
  font-size: 0.92rem;
  line-height: 1.7;
}
.legal-doc :deep(li) {
  margin-bottom: 4px;
}
.legal-doc :deep(strong) {
  color: var(--ink);
}
.legal-doc :deep(a) {
  color: var(--accent-hi);
}
.legal-doc :deep(dl) {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  font-size: 0.92rem;
  margin: 0 0 12px;
}
.legal-doc :deep(dt) {
  color: var(--muted);
  font-family: var(--f-mono);
  font-size: 0.8rem;
  padding-top: 2px;
}
.legal-doc :deep(dd) {
  margin: 0;
  color: var(--ink);
}
</style>
