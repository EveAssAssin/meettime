<template>
  <div class="themes">
    <span class="hint">主題</span>
    <button
      v-for="t in themes" :key="t.id"
      class="swatch" :class="[`sw-${t.id}`, { active: modelValue === t.id }]"
      :title="t.name" :aria-label="t.name"
      @click="$emit('update:modelValue', t.id)"
    />
  </div>
</template>

<script setup>
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])

const themes = [
  { id: 'midnight', name: '深夜流光' },
  { id: 'sunset', name: '暖陽晚霞' },
  { id: 'forest', name: '森林霧光' },
  { id: 'cream', name: '奶油鬆弛' },
  { id: 'sakura', name: '櫻花粉嫩' },
]
</script>

<style scoped>
.themes { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hint { font-size: 12px; color: var(--text-lo); margin-right: 2px; }
.swatch {
  width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
  border: 2px solid rgba(255,255,255,0.45); transition: transform 0.15s;
  padding: 0;
}
.swatch:hover { transform: scale(1.15); }
.swatch.active { border-color: var(--text-hi); box-shadow: 0 0 0 2px var(--accent); }
.sw-midnight { background: linear-gradient(135deg, #4338ca, #db2777, #0891b2); }
.sw-sunset { background: linear-gradient(135deg, #ea580c, #e11d48, #f59e0b); }
.sw-forest { background: linear-gradient(135deg, #059669, #365314, #155e75); }
.sw-cream { background: linear-gradient(135deg, #fcd34d, #f9a8d4, #c7d2fe); }
.sw-sakura { background: linear-gradient(135deg, #f9a8d4, #fda4af, #e9d5ff); }
</style>
