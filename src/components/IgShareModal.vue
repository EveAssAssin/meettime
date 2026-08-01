<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="glass modal">
      <h3>✨ IG 美照</h3>
      <p v-if="!blobUrl && !error" class="hint">生成中…</p>
      <p v-if="error" class="error">{{ error }}</p>
      <img v-if="blobUrl" :src="blobUrl" class="preview" alt="分享圖預覽" />
      <div class="actions">
        <button class="pill" @click="$emit('close')">關閉</button>
        <button v-if="blob" class="pill" @click="download">下載</button>
        <button v-if="blob && canShare" class="pill primary" @click="share">分享</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { makeShareImage } from '../lib/igcard'

const props = defineProps({
  schedule: { type: Object, required: true },
  doneName: String,
  roomTitle: { type: String, default: '' },
  theme: { type: String, default: 'midnight' },
})
defineEmits(['close'])

const blob = ref(null)
const blobUrl = ref('')
const error = ref('')
const canShare = typeof navigator !== 'undefined' && !!navigator.canShare

onMounted(async () => {
  try {
    blob.value = await makeShareImage({
      schedule: props.schedule,
      doneName: props.doneName,
      roomTitle: props.roomTitle,
      theme: props.theme,
    })
    blobUrl.value = URL.createObjectURL(blob.value)
  } catch (e) {
    error.value = '生成失敗：' + (e.message || e)
  }
})

onUnmounted(() => {
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
})

function download() {
  const a = document.createElement('a')
  a.href = blobUrl.value
  a.download = `meettime-${props.schedule.title}.png`
  a.click()
}

async function share() {
  const file = new File([blob.value], 'meettime.png', { type: 'image/png' })
  if (navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: props.schedule.title })
    } catch { /* 使用者取消 */ }
  } else {
    download()
  }
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 20;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 380px; padding: 20px;
  max-height: 92vh; overflow-y: auto; text-align: center;
}
h3 { font-size: 17px; margin-bottom: 12px; }
.hint { color: var(--text-mid); font-size: 14px; padding: 30px 0; }
.error { color: #fca5a5; font-size: 13px; padding: 16px 0; }
.preview {
  width: 100%; border-radius: 14px;
  border: 1px solid var(--glass-border);
}
.actions { display: flex; justify-content: center; gap: 10px; margin-top: 16px; }
</style>
