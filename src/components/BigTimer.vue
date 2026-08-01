<template>
  <div v-if="arrived" class="arrived">🎉 時間到了！</div>
  <div v-else class="count">
    <div class="unit"><b>{{ pad(r.d) }}</b><span>天</span></div>
    <div class="unit"><b>{{ pad(r.h) }}</b><span>時</span></div>
    <div class="unit"><b>{{ pad(r.m) }}</b><span>分</span></div>
    <div class="unit"><b>{{ pad(r.s) }}</b><span>秒</span></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { splitRemaining, pad } from '../lib/time'

const props = defineProps({ target: { type: String, required: true } })

const now = ref(Date.now())
let timer

onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

const remainMs = computed(() => new Date(props.target).getTime() - now.value)
const r = computed(() => splitRemaining(remainMs.value))
const arrived = computed(() => remainMs.value <= 0)
</script>

<style scoped>
.count { display: flex; justify-content: center; gap: 12px; }
.unit {
  min-width: 86px; padding: 16px 8px 12px; border-radius: 18px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
}
.unit b {
  display: block; font-size: 44px; font-weight: 700; line-height: 1;
  font-variant-numeric: tabular-nums; color: var(--text-hi);
}
.unit span { font-size: 12px; color: var(--text-lo); letter-spacing: 2px; }
.arrived { font-size: 40px; font-weight: 700; text-align: center; padding: 20px 0; }
@media (max-width: 520px) {
  .count { gap: 8px; }
  .unit { min-width: 0; flex: 1; }
  .unit b { font-size: 32px; }
}
</style>
