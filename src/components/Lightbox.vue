<template>
  <div class="lb-overlay" @click.self="$emit('close')">
    <button class="lb-x" @click="$emit('close')">✕</button>
    <button v-if="images.length > 1" class="lb-nav prev" @click.stop="step(-1)">‹</button>
    <img :src="images[idx]?.file_url" :alt="images[idx]?.file_name" class="lb-img" />
    <button v-if="images.length > 1" class="lb-nav next" @click.stop="step(1)">›</button>
    <div v-if="images.length > 1" class="lb-count">{{ idx + 1 }} / {{ images.length }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  images: { type: Array, required: true },
  start: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const idx = ref(props.start)

function step(d) {
  idx.value = (idx.value + d + props.images.length) % props.images.length
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowLeft') step(-1)
  if (e.key === 'ArrowRight') step(1)
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.lb-overlay {
  position: fixed; inset: 0; z-index: 30;
  background: rgba(0,0,0,0.88);
  display: flex; align-items: center; justify-content: center;
}
.lb-img { max-width: 92vw; max-height: 88vh; border-radius: 12px; object-fit: contain; }
.lb-x {
  position: absolute; top: 18px; right: 20px; z-index: 31;
  background: rgba(255,255,255,0.12); border: none; color: #fff;
  width: 40px; height: 40px; border-radius: 50%; font-size: 16px; cursor: pointer;
}
.lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 31;
  background: rgba(255,255,255,0.12); border: none; color: #fff;
  width: 48px; height: 48px; border-radius: 50%; font-size: 26px; cursor: pointer;
}
.lb-nav.prev { left: 16px; }
.lb-nav.next { right: 16px; }
.lb-count {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  color: rgba(255,255,255,0.7); font-size: 13px;
}
</style>
