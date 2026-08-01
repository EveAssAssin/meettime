<template>
  <div class="wrap">
    <p v-if="pageError" class="page-error">{{ pageError }}</p>
    <template v-else-if="store.room">
      <header>
        <router-link class="logo" to="/">Meet<em>Time</em></router-link>
        <div class="members">
          <div
            v-for="m in store.members" :key="m.id"
            class="avatar" :style="{ background: m.color }" :title="m.nickname"
          >{{ m.nickname.slice(0, 1) }}</div>
          <button class="pill share-btn" @click="share">＋ 邀請</button>
        </div>
      </header>

      <div class="toolbar">
        <ThemePicker :model-value="store.room.theme" @update:model-value="store.setTheme" />
        <span v-if="copied" class="copied">已複製邀請連結！</span>
      </div>

      <div v-if="!store.me" class="glass join-bar">
        <span>你還沒加入這個房間</span>
        <form class="join-form" @submit.prevent="join">
          <input v-model="nickname" class="field" placeholder="你的暱稱" required maxlength="12" />
          <button class="pill primary" :disabled="joining">加入</button>
        </form>
      </div>

      <section v-if="store.meeting" class="glass hero">
        <div v-if="store.meeting.photo_url && store.meeting.show_photo" class="photo-wrap">
          <img class="photo" :src="store.meeting.photo_url" alt="" />
        </div>
        <div class="label">COUNTDOWN</div>
        <div class="title">{{ store.meeting.title }}</div>
        <BigTimer :target="store.meeting.meet_at" />
        <div class="date">{{ meetAtText }}</div>
      </section>

      <div class="section-title">
        <h2>等待的行程</h2>
        <button v-if="store.me" class="pill" @click="showForm = true">＋ 新增行程</button>
      </div>

      <Timeline
        :schedules="store.schedules"
        :members="store.members"
        :me-id="store.me?.id"
        @remove="store.removeSchedule"
      />

      <ScheduleForm v-if="showForm" @close="showForm = false" @save="onSave" />
    </template>
    <p v-else class="loading">載入中…</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { dayjs } from '../lib/time'
import BigTimer from '../components/BigTimer.vue'
import ThemePicker from '../components/ThemePicker.vue'
import Timeline from '../components/Timeline.vue'
import ScheduleForm from '../components/ScheduleForm.vue'

const route = useRoute()
const store = useRoomStore()

const pageError = ref('')
const showForm = ref(false)
const copied = ref(false)
const nickname = ref('')
const joining = ref(false)

const meetAtText = computed(() =>
  store.meeting ? dayjs(store.meeting.meet_at).format('YYYY/M/D（dd）HH:mm') : '')

watch(() => store.room?.theme, (t) => {
  if (t) document.body.dataset.theme = t
}, { immediate: true })

onMounted(async () => {
  try {
    await store.loadRoom(route.params.code)
  } catch (e) {
    pageError.value = e.message
  }
})

onUnmounted(() => {
  store.unsubscribe()
  document.body.dataset.theme = 'midnight'
})

async function share() {
  const url = location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: 'MeetTime 一起倒數', url })
      return
    }
  } catch { /* fallthrough */ }
  await navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

async function join() {
  joining.value = true
  try {
    await store.joinRoom(store.room.code, nickname.value.trim())
    await store.loadRoom(store.room.code)
  } catch (e) {
    pageError.value = e.message
  } finally {
    joining.value = false
  }
}

function onSave(payload) {
  store.addSchedule(payload).then(payload.resolve, payload.reject)
}
</script>

<style scoped>
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.logo { font-size: 18px; font-weight: 600; letter-spacing: 2px; color: var(--text-hi); text-decoration: none; }
.logo em { font-style: normal; color: var(--accent); }
.members { display: flex; align-items: center; }
.members .avatar { margin-left: -8px; }
.share-btn { margin-left: 14px; }
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.copied { font-size: 12px; color: var(--accent); }
.join-bar {
  padding: 14px 18px; margin-bottom: 18px; font-size: 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.join-form { display: flex; gap: 10px; }
.join-form .field { width: 150px; padding: 8px 12px; }
.hero { padding: 30px 28px 32px; text-align: center; margin-bottom: 20px; }
.photo-wrap { margin-bottom: 20px; }
.photo {
  width: 112px; height: 112px; border-radius: 50%; object-fit: cover;
  border: 3px solid var(--glass-highlight);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 6px var(--glass-bg);
}
.label { font-size: 13px; color: var(--text-mid); letter-spacing: 4px; margin-bottom: 6px; }
.title { font-size: 22px; font-weight: 600; margin-bottom: 22px; }
.date { margin-top: 20px; font-size: 13px; color: var(--text-mid); }
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 26px 4px 12px; }
.section-title h2 { font-size: 15px; font-weight: 600; color: var(--text-mid); letter-spacing: 1px; }
.loading, .page-error { text-align: center; padding-top: 20vh; color: var(--text-mid); }
</style>
