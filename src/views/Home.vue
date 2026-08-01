<template>
  <div class="wrap home">
    <h1 class="logo">Meet<em>Time</em></h1>
    <p class="tagline">把等待，變成一起倒數的期待</p>

    <section class="glass card">
      <div class="tabs">
        <button class="pill" :class="{ primary: mode === 'create' }" @click="mode = 'create'">建立倒數</button>
        <button class="pill" :class="{ primary: mode === 'join' }" @click="mode = 'join'">加入房間</button>
      </div>

      <form v-if="mode === 'create'" @submit.prevent="onCreate">
        <label>你的暱稱</label>
        <input v-model="nickname" class="field" placeholder="例如：小魯" required maxlength="12" />
        <label>倒數標題</label>
        <input v-model="title" class="field" placeholder="例如：東京之旅出發倒數" required maxlength="30" />
        <label>目標日期時間</label>
        <input v-model="meetAt" class="field" type="datetime-local" required />
        <button class="pill primary submit" :disabled="loading">
          {{ loading ? '建立中…' : '開始倒數 ✨' }}
        </button>
      </form>

      <form v-else @submit.prevent="onJoin">
        <label>房間碼</label>
        <input v-model="code" class="field code-input" placeholder="6 碼房間碼" required maxlength="6" />
        <label>你的暱稱</label>
        <input v-model="nickname" class="field" placeholder="例如：小安" required maxlength="12" />
        <button class="pill primary submit" :disabled="loading">
          {{ loading ? '加入中…' : '加入倒數 →' }}
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room'

const router = useRouter()
const store = useRoomStore()

const mode = ref('create')
const nickname = ref('')
const title = ref('')
const meetAt = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')

async function onCreate() {
  loading.value = true
  error.value = ''
  try {
    const c = await store.createRoom({
      nickname: nickname.value.trim(),
      title: title.value.trim(),
      meetAt: new Date(meetAt.value).toISOString(),
    })
    router.push(`/r/${c}`)
  } catch (e) {
    error.value = e.message || '建立失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

async function onJoin() {
  loading.value = true
  error.value = ''
  try {
    const c = await store.joinRoom(code.value.trim(), nickname.value.trim())
    router.push(`/r/${c}`)
  } catch (e) {
    error.value = e.message || '加入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.home { padding-top: 12vh; max-width: 480px; }
.logo { text-align: center; font-size: 34px; letter-spacing: 3px; }
.logo em { font-style: normal; color: var(--accent); }
.tagline { text-align: center; color: var(--text-mid); font-size: 14px; margin: 8px 0 28px; }
.card { padding: 26px 24px; }
.tabs { display: flex; gap: 10px; margin-bottom: 22px; }
label { display: block; font-size: 13px; color: var(--text-mid); margin: 14px 0 6px; }
.submit { width: 100%; margin-top: 22px; padding: 12px; font-size: 15px; }
.code-input { text-transform: uppercase; letter-spacing: 6px; font-weight: 600; }
.error { margin-top: 14px; font-size: 13px; color: #fca5a5; text-align: center; }
</style>
