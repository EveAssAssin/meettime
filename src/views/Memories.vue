<template>
  <div class="wrap">
    <p v-if="pageError" class="page-error">{{ pageError }}</p>
    <template v-else-if="store.room && store.meeting">
      <header>
        <router-link class="back pill" :to="`/r/${store.room.code}`">← 回倒數</router-link>
      </header>

      <section class="glass mem-hero">
        <div v-if="store.meeting.photo_url" class="mem-photo-wrap">
          <img :src="store.meeting.photo_url" class="mem-photo" alt="" />
        </div>
        <div class="mem-label">MEMORIES</div>
        <h1>{{ store.meeting.title }}</h1>
        <div class="mem-range">{{ rangeText }}</div>
        <div class="stats">
          <div class="stat"><b>{{ dayCount }}</b><span>天</span></div>
          <div class="stat"><b>{{ store.schedules.length }}</b><span>行程</span></div>
          <div class="stat"><b>{{ doneCount }}</b><span>達成</span></div>
          <div class="stat"><b>{{ photoCount }}</b><span>照片</span></div>
        </div>
        <div v-if="store.milestones.length" class="mem-milestones">
          <span v-for="m in store.milestones" :key="m.id" class="mem-ms">
            {{ new Date(m.target_at) <= new Date() ? '✓' : '•' }} {{ m.title }} {{ fmtDay(m.target_at) }}
          </span>
        </div>
      </section>

      <section v-for="g in groups" :key="g.key" class="day-block">
        <div class="day-head">
          <span class="day-date">{{ g.label }}</span>
          <span class="day-line" />
        </div>
        <div v-for="s in g.items" :key="s.id" class="glass mem-card">
          <div class="mem-time">
            {{ fmtTime(s.start_at) }}–{{ fmtTime(s.end_at) }}
            <span v-if="s.completed_at" class="mem-done">✓ {{ memberName(s.completed_by) }} 達成</span>
          </div>
          <div class="mem-title" :style="{ '--c': memberColor(s.member_id) }">{{ s.title }}</div>
          <p v-if="s.note" class="mem-note">{{ s.note }}</p>
          <div v-if="images(s).length" class="mem-photos" :class="`n${Math.min(images(s).length, 3)}`">
            <img
              v-for="(a, ai) in images(s)" :key="a.id"
              :src="a.file_url" :alt="a.file_name"
              @click="lightbox = { images: images(s), start: ai }"
            />
          </div>
          <div class="mem-foot">
            <span>{{ memberName(s.member_id) }}</span>
            <span v-if="reactionSummary(s)" class="mem-reacts">{{ reactionSummary(s) }}</span>
          </div>
        </div>
      </section>

      <p v-if="!store.schedules.length" class="empty">還沒有任何紀錄</p>

      <Lightbox
        v-if="lightbox"
        :images="lightbox.images"
        :start="lightbox.start"
        @close="lightbox = null"
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
import Lightbox from '../components/Lightbox.vue'

const route = useRoute()
const store = useRoomStore()
const pageError = ref('')
const lightbox = ref(null)

watch(() => store.room?.theme, (t) => {
  if (t) document.body.dataset.theme = t
}, { immediate: true })

onMounted(async () => {
  try {
    if (!store.room || store.room.code !== String(route.params.code).toUpperCase()) {
      await store.loadRoom(route.params.code)
    }
  } catch (e) {
    pageError.value = e.message
  }
})

onUnmounted(() => { document.body.dataset.theme = 'midnight' })

const fmtTime = (d) => dayjs(d).format('HH:mm')
const fmtDay = (d) => dayjs(d).format('M/D')
const memberName = (id) => store.members.find((m) => m.id === id)?.nickname || ''
const memberColor = (id) => store.members.find((m) => m.id === id)?.color || 'var(--accent)'
const images = (s) => (s.attachments || []).filter((a) => a.file_type?.startsWith('image/'))

const doneCount = computed(() => store.schedules.filter((s) => s.completed_at).length)
const photoCount = computed(() => store.schedules.reduce((n, s) => n + images(s).length, 0))

const rangeText = computed(() => {
  const dates = [
    ...store.schedules.map((s) => s.start_at),
    ...store.milestones.map((m) => m.target_at),
  ].sort()
  if (!dates.length) return ''
  const a = dayjs(dates[0])
  const b = dayjs(dates.at(-1))
  return a.isSame(b, 'day') ? a.format('YYYY/M/D') : `${a.format('YYYY/M/D')} — ${b.format('M/D')}`
})

const dayCount = computed(() => {
  const days = new Set(store.schedules.map((s) => dayjs(s.start_at).format('YYYY-MM-DD')))
  return days.size
})

const groups = computed(() => {
  const byDay = new Map()
  for (const s of store.schedules) {
    const key = dayjs(s.start_at).format('YYYY-MM-DD')
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(s)
  }
  return [...byDay.entries()].map(([key, items]) => ({
    key,
    label: dayjs(key).format('M月D日（dd）'),
    items,
  }))
})

function reactionSummary(s) {
  const counts = {}
  for (const r of s.schedule_reactions || []) counts[r.emoji] = (counts[r.emoji] || 0) + 1
  return Object.entries(counts).map(([e, n]) => `${e}${n}`).join(' ')
}
</script>

<style scoped>
header { margin-bottom: 16px; }
.back { text-decoration: none; display: inline-block; }
.mem-hero { padding: 34px 28px; text-align: center; margin-bottom: 30px; }
.mem-photo-wrap { margin-bottom: 18px; }
.mem-photo {
  width: 104px; height: 104px; border-radius: 50%; object-fit: cover;
  border: 3px solid var(--glass-highlight);
}
.mem-label { font-size: 12px; letter-spacing: 5px; color: var(--text-mid); margin-bottom: 8px; }
h1 { font-size: 26px; margin-bottom: 8px; }
.mem-range { font-size: 13px; color: var(--text-mid); margin-bottom: 20px; }
.stats { display: flex; justify-content: center; gap: 26px; }
.stat { display: flex; flex-direction: column; }
.stat b { font-size: 26px; font-weight: 700; }
.stat span { font-size: 12px; color: var(--text-lo); }
.mem-milestones { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 18px; }
.mem-ms {
  font-size: 12px; padding: 5px 12px; border-radius: 999px;
  background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-mid);
}
.day-block { margin-bottom: 26px; }
.day-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.day-date { font-size: 14px; font-weight: 600; color: var(--text-mid); white-space: nowrap; }
.day-line { flex: 1; height: 1px; background: var(--glass-border); }
.mem-card { padding: 18px 20px; margin-bottom: 12px; }
.mem-time { font-size: 12px; color: var(--text-mid); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mem-done { color: #6ee7b7; font-weight: 600; }
.mem-title {
  font-size: 17px; font-weight: 600; margin: 6px 0;
  padding-left: 10px; border-left: 3px solid var(--c);
}
.mem-note { font-size: 14px; color: var(--text-mid); line-height: 1.6; margin: 8px 0; }
.mem-photos { display: grid; gap: 8px; margin: 10px 0; }
.mem-photos.n1 { grid-template-columns: 1fr; }
.mem-photos.n2 { grid-template-columns: 1fr 1fr; }
.mem-photos.n3 { grid-template-columns: repeat(3, 1fr); }
.mem-photos img {
  width: 100%; aspect-ratio: 1; object-fit: cover;
  border-radius: 12px; border: 1px solid var(--glass-border); cursor: zoom-in;
}
.mem-photos.n1 img { aspect-ratio: 16/10; }
.mem-foot { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-lo); margin-top: 6px; }
.empty, .loading, .page-error { text-align: center; padding-top: 16vh; color: var(--text-mid); }
</style>
