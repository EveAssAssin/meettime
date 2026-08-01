<template>
  <div class="widget-wrap">
    <template v-if="meeting">
      <div class="w-title">{{ meeting.title }}</div>
      <BigTimer :target="meeting.meet_at" />
      <div class="w-date">{{ dateText }}</div>
      <div v-if="currentSched" class="w-sched live">
        ▶ {{ currentSched.completed_at ? '✓ ' : '' }}{{ currentSched.title }}
        {{ hm(currentSched.start_at) }}–{{ hm(currentSched.end_at) }}
      </div>
      <div v-else-if="nextSched" class="w-sched">
        接下來 {{ hm(nextSched.start_at) }} {{ nextSched.title }}
      </div>
    </template>
    <p v-else-if="error" class="w-msg">{{ error }}</p>
    <p v-else class="w-msg">載入中…</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { dayjs } from '../lib/time'
import BigTimer from '../components/BigTimer.vue'

const route = useRoute()
const meeting = ref(null)
const currentSched = ref(null)
const nextSched = ref(null)
const error = ref('')
let timer

const hm = (d) => dayjs(d).format('HH:mm')

const dateText = computed(() =>
  meeting.value ? dayjs(meeting.value.meet_at).format('YYYY/M/D（dd）HH:mm') : '')

async function load() {
  const { data: room } = await supabase
    .from('rooms').select().eq('code', String(route.params.code).toUpperCase()).single()
  if (!room) {
    error.value = '找不到這個房間'
    return
  }
  document.body.dataset.theme = room.theme
  const { data } = await supabase
    .from('meetings').select().eq('room_id', room.id).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  meeting.value = data
  if (!data) {
    error.value = '目前沒有進行中的倒數'
    return
  }
  const nowIso = new Date().toISOString()
  const { data: cur } = await supabase
    .from('schedules').select('title, start_at, end_at, completed_at')
    .eq('meeting_id', data.id).lte('start_at', nowIso).gt('end_at', nowIso)
    .order('start_at', { ascending: false }).limit(1).maybeSingle()
  currentSched.value = cur
  if (!cur) {
    const { data: nxt } = await supabase
      .from('schedules').select('title, start_at, end_at')
      .eq('meeting_id', data.id).gt('start_at', nowIso)
      .order('start_at').limit(1).maybeSingle()
    nextSched.value = nxt
  } else {
    nextSched.value = null
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 5 * 60 * 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  document.body.dataset.theme = 'midnight'
})
</script>

<style scoped>
.widget-wrap {
  position: relative; z-index: 1;
  min-height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px;
  padding: 24px; text-align: center;
}
.w-title { font-size: 18px; font-weight: 600; letter-spacing: 1px; }
.w-date { font-size: 13px; color: var(--text-mid); }
.w-sched {
  font-size: 13px; color: var(--text-mid);
  padding: 6px 14px; border-radius: 999px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
}
.w-sched.live { color: var(--accent); border-color: var(--accent); font-weight: 600; }
.w-msg { color: var(--text-mid); }
</style>
