<template>
  <div class="wrap home">
    <h1 class="logo">Meet<em>Time</em></h1>
    <p class="tagline">把等待，變成一起倒數的期待</p>

    <section v-if="!auth.user" class="glass card">
      <div class="tabs">
        <button class="pill" :class="{ primary: authMode === 'login' }" @click="authMode = 'login'">登入</button>
        <button class="pill" :class="{ primary: authMode === 'register' }" @click="authMode = 'register'">建立帳號</button>
      </div>

      <form @submit.prevent="onAuth">
        <label>帳號</label>
        <input v-model="username" class="field" placeholder="例如：louis" required maxlength="20" autocomplete="username" />
        <label>密碼{{ authMode === 'register' ? '（至少 6 碼）' : '' }}</label>
        <input v-model="password" class="field" type="password" required minlength="6" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'" />
        <button class="pill primary submit" :disabled="loading">
          {{ loading ? '處理中…' : (authMode === 'login' ? '登入 →' : '建立帳號 ✨') }}
        </button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <template v-else>
      <div class="user-bar">
        <span>👤 {{ auth.user.username }}</span>
        <button class="pill sm" @click="logout">登出</button>
      </div>

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

      <section v-if="rooms.length" class="glass recent">
        <h2>我的房間</h2>
        <router-link
          v-for="r in rooms" :key="r.code"
          class="recent-item" :to="`/r/${r.code}`"
        >
          <b>{{ r.code }}</b>
          <span>{{ r.title || r.nickname }}</span>
          <em>→</em>
        </router-link>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const store = useRoomStore()
const auth = useAuthStore()

const authMode = ref('login')
const username = ref('')
const password = ref('')
const mode = ref('create')
const nickname = ref('')
const title = ref('')
const meetAt = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const rooms = ref([])

async function loadRooms() {
  const dbRooms = await store.myRooms()
  const seen = new Set(dbRooms.map((r) => r.code))
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('meettime:identity:')) continue
    const c = key.split(':')[2]
    if (seen.has(c)) continue
    try {
      const { nickname: n } = JSON.parse(localStorage.getItem(key))
      dbRooms.push({ code: c, nickname: n, title: '' })
    } catch { /* skip */ }
  }
  rooms.value = dbRooms
}

onMounted(() => { if (auth.user) loadRooms() })
watch(() => auth.user, (u) => { if (u) loadRooms() })

async function onAuth() {
  loading.value = true
  error.value = ''
  try {
    if (authMode.value === 'login') {
      await auth.login(username.value.trim(), password.value)
    } else {
      await auth.register(username.value.trim(), password.value)
    }
    nickname.value = nickname.value || auth.user.username
    if (route.query.redirect) router.push(String(route.query.redirect))
  } catch (e) {
    error.value = e.message || '失敗，請再試一次'
  } finally {
    loading.value = false
  }
}

function logout() {
  auth.logout()
  rooms.value = []
}

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
.home { padding-top: 9vh; max-width: 480px; }
.logo { text-align: center; font-size: 34px; letter-spacing: 3px; }
.logo em { font-style: normal; color: var(--accent); }
.tagline { text-align: center; color: var(--text-mid); font-size: 14px; margin: 8px 0 24px; }
.user-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; font-size: 14px; color: var(--text-mid);
}
.pill.sm { font-size: 12px; padding: 5px 12px; }
.card { padding: 26px 24px; }
.tabs { display: flex; gap: 10px; margin-bottom: 22px; }
label { display: block; font-size: 13px; color: var(--text-mid); margin: 14px 0 6px; }
.submit { width: 100%; margin-top: 22px; padding: 12px; font-size: 15px; }
.code-input { text-transform: uppercase; letter-spacing: 6px; font-weight: 600; }
.error { margin-top: 14px; font-size: 13px; color: #fca5a5; text-align: center; }
.recent { margin-top: 20px; padding: 18px 20px; }
.recent h2 { font-size: 13px; color: var(--text-mid); letter-spacing: 1px; margin-bottom: 10px; }
.recent-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 12px; text-decoration: none;
  color: var(--text-hi); font-size: 14px; transition: background 0.15s;
}
.recent-item:hover { background: var(--glass-bg); }
.recent-item b { letter-spacing: 3px; color: var(--accent); }
.recent-item span { color: var(--text-mid); font-size: 13px; }
.recent-item em { margin-left: auto; font-style: normal; color: var(--text-lo); }
</style>
