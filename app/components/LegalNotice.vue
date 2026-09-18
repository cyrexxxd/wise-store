<script setup lang="ts">
// Единый вид для двух предупреждений на страницах T-25: "данные-заглушка,
// доделает владелец" и "черновик, нужна юридическая проверка перед публикацией".
</script>

<template>
  <div class="legal-notice">
    <svg class="pico"><use href="#ic-warn" /></svg>
    <p><slot /></p>
  </div>
</template>

<style scoped>
.legal-notice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  margin-bottom: 28px;
  background: var(--surface-2);
  border: 1px solid var(--line-hi);
  border-left: 3px solid var(--accent-hi);
  border-radius: 10px;
}
.legal-notice .pico {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--accent-hi);
  margin-top: 2px;
}
.legal-notice p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.6;
  color: var(--ink-2);
}
</style>
