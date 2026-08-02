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
          <button
            v-if="isOwner" class="pill member-btn" title="成員管理"
            @click="showMembers = !showMembers"
          >⚙</button>
          <button class="pill share-btn" @click="share">＋ 邀請</button>
        </div>
      </header>

      <div class="toolbar">
        <ThemePicker :model-value="store.room.theme" @update:model-value="store.setTheme" />
        <button class="pill code-chip" title="點擊複製房間碼" @click="copyCode">
          房間碼 <b>{{ store.room.code }}</b>
        </button>
        <button
          v-if="notifState !== 'granted'" class="pill" title="行程完成時通知我"
          @click="enableNotif"
        >🔔 開啟通知</button>
        <span v-if="copied" class="copied">{{ copiedText }}</span>
      </div>

      <div v-if="!store.me && !auth.user" class="glass join-bar">
        <span>請先登入或建立帳號，才能加入這個倒數</span>
        <router-link class="pill primary" :to="`/?redirect=/r/${store.room.code}`">前往登入 →</router-link>
      </div>

      <div v-else-if="!store.me" class="glass join-bar">
        <div v-if="store.members.length" class="claim-row">
          <span>你是哪一位？點名字直接進入：</span>
          <div class="claim-chips">
            <button
              v-for="m in store.members" :key="m.id"
              class="pill claim-chip" :style="{ borderColor: m.color }"
              @click="store.claimMember(m)"
            >{{ m.nickname }}</button>
          </div>
        </div>
        <form class="join-form" @submit.prevent="join">
          <span class="join-hint">{{ store.members.length ? '都不是？' : '' }}輸入新暱稱加入：</span>
          <input v-model="nickname" class="field" :placeholder="auth.user?.username || '你的暱稱'" required maxlength="12" />
          <button class="pill primary" :disabled="joining">加入</button>
        </form>
      </div>

      <div v-if="isOwner && showMembers" class="glass member-manage">
        <div class="mm-head">成員管理 <span class="mm-hint">（沒有行程的重複成員可刪除）</span></div>
        <div v-for="m in store.members" :key="m.id" class="mm-row">
          <span class="avatar" :style="{ background: m.color }">{{ m.nickname.slice(0, 1) }}</span>
          <span class="mm-name">{{ m.nickname }}</span>
          <span class="mm-count">{{ store.scheduleCountOf(m.id) }} 個行程</span>
          <button
            v-if="m.id !== store.room.owner_member_id && store.scheduleCountOf(m.id) === 0"
            class="pill mm-del" @click="onRemoveMember(m.id)"
          >刪除</button>
          <span v-else class="mm-lock">{{ m.id === store.room.owner_member_id ? '房主' : '' }}</span>
        </div>
      </div>

      <section v-if="store.meeting" class="glass hero">
        <div v-if="store.meeting.photo_url && store.meeting.show_photo" class="photo-wrap">
          <img class="photo" :src="store.meeting.photo_url" alt="" />
          <button v-if="store.me" class="photo-x" title="移除照片" @click="store.removeMeetingPhoto">✕</button>
        </div>
        <div class="label">COUNTDOWN</div>
        <div class="title">
          {{ store.meeting.title }}
          <button
            v-if="isOwner" class="edit-meeting" title="修改標題與時間"
            @click="showMeetingForm = true"
          >✎</button>
        </div>

        <template v-if="store.journeyDone">
          <div class="journey-done">🎉 旅程完成！</div>
          <router-link class="pill primary memories-link" :to="`/r/${store.room.code}/memories`">
            📖 打開回憶錄
          </router-link>
        </template>
        <template v-else>
          <div v-if="store.nextMilestone" class="next-ms">距離「{{ store.nextMilestone.title }}」</div>
          <BigTimer :target="store.countdownTarget" />
          <div class="date">{{ meetAtText }}</div>
        </template>

        <div v-if="store.milestones.length > 1 || isOwner" class="ms-chips">
          <span
            v-for="m in store.milestones" :key="m.id"
            class="ms-chip"
            :class="{ passed: new Date(m.target_at) <= now, next: m.id === store.nextMilestone?.id }"
          >
            {{ new Date(m.target_at) <= now ? '✓ ' : '' }}{{ m.title }} {{ msDate(m) }}
          </span>
          <button v-if="isOwner" class="pill ms-manage" @click="showMilestones = true">⚑ 管理</button>
        </div>

        <div v-if="store.meeting.attachments?.length" class="hero-atts">
          <template v-for="a in store.meeting.attachments" :key="a.id">
            <img
              v-if="isImage(a.file_type)"
              :src="a.file_url" :alt="a.file_name" class="hero-thumb"
              style="cursor: zoom-in"
              @click="openLightbox(store.meeting.attachments.filter(x => isImage(x.file_type)), store.meeting.attachments.filter(x => isImage(x.file_type)).findIndex(x => x.id === a.id))"
            />
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

      <section v-if="quickSchedule && store.me" class="glass live-card">
        <div class="live-info">
          <span class="live-tag" :class="{ upcoming: !quickSchedule.live }">
            {{ quickSchedule.live ? '● 進行中' : '接下來' }}
          </span>
          <b class="live-title" :class="{ done: quickSchedule.s.completed_at }">{{ quickSchedule.s.title }}</b>
          <span class="live-time">
            {{ dayjs(quickSchedule.s.start_at).format('HH:mm') }}–{{ dayjs(quickSchedule.s.end_at).format('HH:mm') }}
          </span>
          <span class="live-remain">{{ quickRemainText }}</span>
        </div>
        <div class="live-actions">
          <button
            class="live-btn check-btn" :class="{ checked: quickSchedule.s.completed_at }"
            @click="store.toggleComplete(quickSchedule.s)"
          >{{ quickSchedule.s.completed_at ? '✓ 已達成' : '✓ 達成' }}</button>
          <button class="live-btn" :disabled="uploading" @click="openScheduleAttach(quickSchedule.s)">
            {{ uploading ? '…' : '📷 傳照片' }}
          </button>
        </div>
      </section>

      <div class="section-title">
        <h2>{{ store.journeyDone ? '旅程紀錄' : '等待的行程' }}</h2>
        <div class="section-actions">
          <router-link class="pill" :to="`/r/${store.room.code}/memories`">📖 回憶錄</router-link>
          <button v-if="store.me" class="pill" @click="showForm = true">＋ 新增行程</button>
        </div>
      </div>

      <Timeline
        :schedules="store.schedules"
        :members="store.members"
        :me-id="store.me?.id"
        @remove="store.removeSchedule"
        @edit="openEdit"
        @toggle-complete="store.toggleComplete"
        @attach="openScheduleAttach"
        @react="store.toggleReaction"
        @preview="openLightbox"
        @share="shareTarget = $event"
        @quick-add="onQuickAdd"
      />
      <input ref="schedAttInput" type="file" accept="image/*,*/*" multiple hidden @change="onSchedAttPick" />

      <MeetingForm
        v-if="showMeetingForm"
        :meeting="store.meeting"
        @close="showMeetingForm = false"
        @save="onMeetingSave"
      />

      <MilestoneForm
        v-if="showMilestones"
        :milestones="store.milestones"
        @close="showMilestones = false"
        @add="onMilestoneAdd"
        @remove="onMilestoneRemove"
        @update="onMilestoneUpdate"
      />

      <Lightbox
        v-if="lightbox"
        :images="lightbox.images"
        :start="lightbox.start"
        @close="lightbox = null"
      />

      <IgShareModal
        v-if="shareTarget"
        :schedule="shareTarget"
        :done-name="doneName(shareTarget)"
        :room-title="store.meeting?.title || ''"
        :theme="store.room?.theme || 'midnight'"
        @close="shareTarget = null"
      />

      <ScheduleForm
        v-if="showForm"
        :schedule="editingSchedule"
        :prefill="formPrefill"
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
import { useAuthStore } from '../stores/auth'
import { dayjs } from '../lib/time'
import BigTimer from '../components/BigTimer.vue'
import ThemePicker from '../components/ThemePicker.vue'
import Timeline from '../components/Timeline.vue'
import ScheduleForm from '../components/ScheduleForm.vue'
import MeetingForm from '../components/MeetingForm.vue'
import Lightbox from '../components/Lightbox.vue'
import IgShareModal from '../components/IgShareModal.vue'
import MilestoneForm from '../components/MilestoneForm.vue'

const route = useRoute()
const store = useRoomStore()
const auth = useAuthStore()

const pageError = ref('')
const showForm = ref(false)
const editingSchedule = ref(null)
const formPrefill = ref(null)
const copied = ref(false)
const nickname = ref('')
const joining = ref(false)
const photoInput = ref()
const attInput = ref()
const schedAttInput = ref()
const uploading = ref(false)
const uploadError = ref('')
const showMeetingForm = ref(false)
const copiedText = ref('')
const attachTarget = ref(null)
const notifState = ref(typeof Notification !== 'undefined' ? Notification.permission : 'denied')

const lightbox = ref(null)
const shareTarget = ref(null)
const showMilestones = ref(false)
const showMembers = ref(false)
const now = ref(new Date())
let nowTimer

async function onRemoveMember(id) {
  try {
    await store.removeMember(id)
  } catch (e) {
    uploadError.value = e.message
  }
}

const isImage = (t) => t && t.startsWith('image/')
const isOwner = computed(() => store.me && store.room?.owner_member_id === store.me.id)

function openLightbox(images, start) {
  lightbox.value = { images, start: Math.max(0, start) }
}

function doneName(schedule) {
  if (!schedule.completed_at) return ''
  return store.members.find((m) => m.id === schedule.completed_by)?.nickname || ''
}

const quickSchedule = computed(() => {
  const t = now.value.getTime()
  const live = store.schedules.find(
    (s) => t >= +new Date(s.start_at) && t < +new Date(s.end_at),
  )
  if (live) return { s: live, live: true }
  const next = store.schedules.find((s) => +new Date(s.start_at) > t)
  return next ? { s: next, live: false } : null
})

function fmtDur(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t / 60) % 60)
  const s = t % 60
  if (h > 0) return `${h} 時 ${m} 分`
  if (m > 0) return `${m} 分 ${String(s).padStart(2, '0')} 秒`
  return `${s} 秒`
}

const quickRemainText = computed(() => {
  if (!quickSchedule.value) return ''
  const q = quickSchedule.value
  const t = now.value.getTime()
  return q.live
    ? `⏳ 剩 ${fmtDur(+new Date(q.s.end_at) - t)}`
    : `${fmtDur(+new Date(q.s.start_at) - t)}後開始`
})

const meetAtText = computed(() =>
  store.countdownTarget ? dayjs(store.countdownTarget).format('YYYY/M/D（dd）HH:mm') : '')

const msDate = (m) => dayjs(m.target_at).format('M/D')

function onMilestoneAdd(payload) {
  store.addMilestone(payload).then(payload.resolve, payload.reject)
}

function onMilestoneUpdate(payload) {
  store.updateMilestone(payload).then(payload.resolve, payload.reject)
}

async function onMilestoneRemove(id) {
  try {
    await store.removeMilestone(id)
  } catch (e) {
    uploadError.value = e.message
  }
}

watch(() => store.room?.theme, (t) => {
  if (t) document.body.dataset.theme = t
}, { immediate: true })

onMounted(async () => {
  nowTimer = setInterval(() => { now.value = new Date() }, 1000)
  if (auth.user) nickname.value = auth.user.username
  try {
    await store.loadRoom(route.params.code)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      store.subscribePush().catch(() => {})
    }
  } catch (e) {
    pageError.value = e.message
  }
})

onUnmounted(() => {
  clearInterval(nowTimer)
  store.unsubscribe()
  document.body.dataset.theme = 'midnight'
})

async function share() {
  const url = `${location.origin}/r/${store.room.code}`
  try {
    if (navigator.share) {
      await navigator.share({ title: 'MeetTime 一起倒數', url })
      return
    }
  } catch { /* fallthrough */ }
  await navigator.clipboard.writeText(url)
  copiedText.value = '已複製邀請連結！'
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

function onQuickAdd(range) {
  formPrefill.value = range
  editingSchedule.value = null
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingSchedule.value = null
  formPrefill.value = null
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

async function copyCode() {
  await navigator.clipboard.writeText(store.room.code)
  copiedText.value = '已複製房間碼！'
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

async function enableNotif() {
  try {
    notifState.value = await store.subscribePush()
  } catch (e) {
    uploadError.value = e.message
  }
}

function onMeetingSave(payload) {
  store.updateMeeting(payload).then(payload.resolve, payload.reject)
}

function openScheduleAttach(schedule) {
  attachTarget.value = schedule
  schedAttInput.value.click()
}

async function onSchedAttPick(e) {
  const files = [...e.target.files]
  e.target.value = ''
  if (!files.length || !attachTarget.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    await store.addScheduleFiles(attachTarget.value, files)
  } catch (err) {
    uploadError.value = err.message || '上傳失敗'
  } finally {
    uploading.value = false
    attachTarget.value = null
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
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.copied { font-size: 12px; color: var(--accent); }
.code-chip { letter-spacing: 1px; }
.code-chip b { letter-spacing: 3px; color: var(--accent); }
.edit-meeting {
  background: none; border: none; color: var(--text-lo); cursor: pointer;
  font-size: 15px; padding: 0 4px; vertical-align: middle;
}
.edit-meeting:hover { color: var(--accent); }
.join-bar {
  padding: 16px 18px; margin-bottom: 18px; font-size: 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.claim-row { display: flex; flex-direction: column; gap: 8px; }
.claim-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.claim-chip { border-width: 2px; font-weight: 600; }
.join-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.join-hint { font-size: 13px; color: var(--text-mid); }
.join-form .field { width: 150px; padding: 8px 12px; }
.member-btn { margin-left: 14px; }
.share-btn { margin-left: 8px; }
.member-manage { padding: 14px 18px; margin-bottom: 18px; }
.mm-head { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.mm-hint { font-size: 12px; color: var(--text-lo); font-weight: 400; }
.mm-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.mm-name { font-size: 14px; font-weight: 600; }
.mm-count { font-size: 12px; color: var(--text-lo); }
.mm-del { font-size: 12px; padding: 4px 12px; margin-left: auto; color: #fca5a5; }
.mm-lock { font-size: 12px; color: var(--text-lo); margin-left: auto; }
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
.live-card {
  padding: 16px 18px; margin: 20px 0 4px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap;
}
.live-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.live-tag {
  font-size: 12px; font-weight: 700; color: var(--accent);
  padding: 3px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  animation: pulse 1.8s ease-in-out infinite; white-space: nowrap;
}
.live-tag.upcoming { animation: none; color: var(--text-mid); background: var(--glass-bg); }
@keyframes pulse { 50% { opacity: 0.55; } }
.live-title { font-size: 16px; }
.live-title.done { text-decoration: line-through; opacity: 0.7; }
.live-time { font-size: 12px; color: var(--text-mid); font-variant-numeric: tabular-nums; }
.live-remain {
  font-size: 13px; font-weight: 700; color: var(--accent);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.live-actions { display: flex; gap: 10px; flex: 1; justify-content: flex-end; min-width: 200px; }
.live-btn {
  padding: 12px 18px; border-radius: 14px; font-size: 15px; font-weight: 600;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  color: var(--text-hi); cursor: pointer; font-family: inherit; transition: 0.15s;
}
.live-btn:active { transform: scale(0.96); }
.check-btn.checked { background: rgba(34,197,94,0.3); border-color: rgba(34,197,94,0.6); }
@media (max-width: 520px) {
  .live-actions { min-width: 0; width: 100%; }
  .live-btn { flex: 1; padding: 14px 10px; }
}
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 26px 4px 12px; flex-wrap: wrap; gap: 8px; }
.section-title h2 { font-size: 15px; font-weight: 600; color: var(--text-mid); letter-spacing: 1px; }
.section-actions { display: flex; gap: 8px; }
.section-actions .pill { text-decoration: none; }
.journey-done { font-size: 36px; font-weight: 700; padding: 18px 0 8px; }
.memories-link { display: inline-block; text-decoration: none; margin-top: 8px; padding: 10px 22px; }
.next-ms { font-size: 14px; color: var(--text-mid); margin-bottom: 12px; }
.ms-chips {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  margin-top: 18px; align-items: center;
}
.ms-chip {
  font-size: 12px; padding: 5px 12px; border-radius: 999px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  color: var(--text-mid);
}
.ms-chip.passed { color: #6ee7b7; border-color: rgba(34,197,94,0.4); }
.ms-chip.next { color: var(--text-hi); border-color: var(--accent); }
.ms-manage { font-size: 12px; padding: 5px 12px; }
.loading, .page-error { text-align: center; padding-top: 20vh; color: var(--text-mid); }
</style>
