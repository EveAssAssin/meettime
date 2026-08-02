<template>
  <div class="aurora"><span class="a1" /><span class="a2" /><span class="a3" /><span class="a4" /></div>
  <router-view />
  <div v-if="showPwaHint" class="pwa-hint">
    <div class="pwa-text">
      <b>💡 保持登入不被 iOS 清除</b>
      <span>點 Safari 下方「分享」→「加入主畫面」，之後從主畫面圖示開啟，登入與資料就會永久保留（Safari 超過 7 天沒開會被系統清除）。</span>
    </div>
    <button class="pwa-x" @click="dismiss">✕</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const showPwaHint = ref(false)

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

function dismiss() {
  showPwaHint.value = false
  localStorage.setItem('meettime:pwa-hint-dismissed', String(Date.now()))
}

onMounted(() => {
  useAuthStore().tryAutoLogin()
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})

  if (isIos() && !isStandalone()) {
    const dismissed = Number(localStorage.getItem('meettime:pwa-hint-dismissed') || 0)
    // 關閉後 3 天內不再顯示；storage 被清掉時自然會再出現（正是需要提醒的時機）
    if (Date.now() - dismissed > 3 * 24 * 3600 * 1000) showPwaHint.value = true
  }
})
</script>

<style scoped>
.pwa-hint {
  position: fixed; left: 12px; right: 12px; bottom: 14px; z-index: 40;
  display: flex; gap: 10px; align-items: flex-start;
  padding: 14px 16px; border-radius: 16px;
  background: color-mix(in srgb, var(--page-bg) 82%, #ffffff 10%);
  border: 1px solid var(--glass-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.pwa-text { display: flex; flex-direction: column; gap: 4px; }
.pwa-text b { font-size: 14px; }
.pwa-text span { font-size: 12px; color: var(--text-mid); line-height: 1.6; }
.pwa-x {
  background: none; border: none; color: var(--text-lo);
  font-size: 14px; cursor: pointer; padding: 2px 4px; flex-shrink: 0;
}
</style>
