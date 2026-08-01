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
          <button v-if="store.me" class="photo-x" title="移除照片" @click="store.removeMeetingPhoto">✕</button>
        </div>
        <div class="label">COUNTDOWN</div>
        <div class="title">{{ store.meeting.title }}</div>
        <BigTimer :target="store.meeting.meet_at" />
        <div class="date">{{ meetAtText }}</div>

        <div v-if="store.meeting.attachments?.length" class="hero-atts">
          <template v-for="a in store.meeting.attachments" :key="a.id">
            <a v-if="isImage(a.file_type)" :href="a.file_url" target="_blank" rel="noopener">
              <img :src="a.file_url" :alt="a.file_name" class="hero-thumb" />
            </a>
            <a v-else :href="a.file_url" target="_blank" rel="noopener" class="hero-file">
              📎 {{ a.file_name }}
            </a>
            <button v-if="store.me" class="att-x" title="刪除附件" @click="store.removeMeetingAttachment(a.id)">✕</button>
          </template>
        </div>

        <div v-if="store.me" class="hero-actions">
          <button class="pill" :disabled="uploading" @click="photoInput.click()">
            📷 {{ store.meeting.photo_url ? '換封面照片' : '放封面照片' }}
          </button>
          <button class="pill" :disabled="uploading" @click="attInput.click()">
            {{ uploading ? '上傳中…' : '📎 加入附件' }}
          </button>
          <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhotoPick" />
          <input ref="attInput" type="file" multiple hidden @change="onAttPick" />
        </div>
        <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
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
        @edit="openEdit"
      />

      <ScheduleForm
        v-if="showForm"
        :schedule="editingSchedule"
        @close="closeForm"
        @save="onSave"
      />
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
const editingSchedule = ref(null)
const copied = ref(false)
const nickname = ref('')
const joining = ref(false)
const photoInput = ref()
const attInput = ref()
const uploading = ref(false)
const uploadError = ref('')

const isImage = (t) => t && t.startsWith('image/')

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
  store.saveSchedule(payload).then(payload.resolve, payload.reject)
}

function openEdit(schedule) {
  editingSchedule.value = schedule
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingSchedule.value = null
}

async function onPhotoPick(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    await store.setMeetingPhoto(file)
  } catch (err) {
    uploadError.value = err.message || '上傳失敗'
  } finally {
    uploading.value = false
  }
}

async function onAttPick(e) {
  const files = [...e.target.files]
  e.target.value = ''
  if (!files.length) return
  uploading.value = true
  uploadError.value = ''
  try {
    await store.addMeetingFiles(files)
  } catch (err) {
    uploadError.value = err.message || '上傳失敗'
  } finally {
    uploading.value = false
  }
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
.photo-wrap { margin-bottom: 20px; position: relative; display: inline-block; }
.photo-x {
  position: absolute; top: 0; right: -6px;
  width: 24px; height: 24px; border-radius: 50%; font-size: 11px;
  background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--glass-border);
  cursor: pointer;
}
.hero-atts {
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
  margin-top: 16px; align-items: center;
}
.hero-thumb {
  width: 64px; height: 64px; object-fit: cover; border-radius: 10px;
  border: 1px solid var(--glass-border); display: block;
}
.hero-file {
  display: inline-flex; align-items: center; font-size: 12px;
  padding: 6px 12px; border-radius: 999px; max-width: 220px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  color: var(--text-mid); text-decoration: none;
}
.hero-file:hover { color: var(--text-hi); }
.att-x {
  background: none; border: none; color: var(--text-lo); cursor: pointer;
  font-size: 11px; padding: 0 2px; margin-right: 6px;
}
.att-x:hover { color: #fca5a5; }
.hero-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
.upload-error { margin-top: 10px; font-size: 12px; color: #fca5a5; }
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
