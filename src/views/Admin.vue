<template>
  <div class="wrap admin">
    <template v-if="!authed">
      <section class="glass gate">
        <h1>🔐 管理後台</h1>
        <form @submit.prevent="login">
          <input v-model="pw" class="field" type="password" placeholder="管理密碼" required />
          <button class="pill primary">進入</button>
        </form>
        <p v-if="gateError" class="error">{{ gateError }}</p>
      </section>
    </template>

    <template v-else>
      <header>
        <h1>MeetTime 管理後台</h1>
        <button class="pill" @click="load">↻ 重新整理</button>
      </header>

      <section class="stats-row">
        <div class="glass stat-card"><b>{{ rooms.length }}</b><span>房間</span></div>
        <div class="glass stat-card"><b>{{ totals.members }}</b><span>成員</span></div>
        <div class="glass stat-card"><b>{{ totals.meetings }}</b><span>倒數事件</span></div>
        <div class="glass stat-card"><b>{{ totals.schedules }}</b><span>行程</span></div>
        <div class="glass stat-card"><b>{{ totals.attachments }}</b><span>附件</span></div>
      </section>

      <p v-if="error" class="error">{{ error }}</p>

      <section v-for="r in rooms" :key="r.id" class="glass room-card">
        <div class="room-head" @click="toggle(r.id)">
          <b class="room-code">{{ r.code }}</b>
          <span class="room-title">{{ r.meetings?.[0]?.title || '（無事件）' }}</span>
          <span class="room-meta">
            {{ r.members?.[0]?.count ?? 0 }} 成員 ·
            {{ dayjs(r.created_at).format('YYYY/M/D') }}
          </span>
          <span class="room-arrow">{{ expanded === r.id ? '▾' : '▸' }}</span>
        </div>

        <div v-if="expanded === r.id" class="room-body">
          <div class="room-actions">
            <a class="pill" :href="`/r/${r.code}`" target="_blank">開啟房間</a>
            <a class="pill" :href="`/r/${r.code}/memories`" target="_blank">回憶錄</a>
            <button class="pill danger" @click="removeRoom(r)">🗑 刪除整個房間</button>
          </div>

          <div v-if="detail" class="detail">
            <h3>成員</h3>
            <div v-for="m in detail.members" :key="m.id" class="d-row">
              <span class="avatar" :style="{ background: m.color }">{{ m.nickname.slice(0, 1) }}</span>
              <span>{{ m.nickname }}</span>
              <span class="d-meta">{{ schedCount(m.id) }} 行程</span>
              <button class="pill danger sm" @click="removeMember(m)">刪除</button>
            </div>

            <h3>行程（{{ detail.schedules.length }}）</h3>
            <div v-for="s in detail.schedules" :key="s.id" class="d-row">
              <span class="d-time">{{ dayjs(s.start_at).format('M/D HH:mm') }}</span>
              <span>{{ s.title }}</span>
              <span class="d-meta">
                {{ s.completed_at ? '✓ 完成' : '' }}
                {{ (s.attachments || []).length ? `📎${(s.attachments || []).length}` : '' }}
              </span>
              <button class="pill danger sm" @click="removeSchedule(s)">刪除</button>
            </div>
          </div>
          <p v-else class="d-loading">載入明細中…</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { dayjs } from '../lib/time'

const PW_HASH = 'a4923bf082eb9c353bc46cbb2e402e6d9b0adad5d3754c7c7157f609487ca330'

const authed = ref(sessionStorage.getItem('meettime:admin') === PW_HASH)
const pw = ref('')
const gateError = ref('')
const rooms = ref([])
const totals = ref({ members: 0, meetings: 0, schedules: 0, attachments: 0 })
const expanded = ref(null)
const detail = ref(null)
const error = ref('')

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function login() {
  if ((await sha256(pw.value)) === PW_HASH) {
    sessionStorage.setItem('meettime:admin', PW_HASH)
    authed.value = true
    load()
  } else {
    gateError.value = '密碼錯誤'
  }
}

async function load() {
  error.value = ''
  const { data, error: e } = await supabase
    .from('rooms')
    .select('*, members(count), meetings(id, title, status)')
    .order('created_at', { ascending: false })
  if (e) { error.value = e.message; return }
  rooms.value = data || []

  const count = async (table) => {
    const { count: c } = await supabase.from(table).select('*', { count: 'exact', head: true })
    return c || 0
  }
  totals.value = {
    members: await count('members'),
    meetings: await count('meetings'),
    schedules: await count('schedules'),
    attachments: await count('attachments'),
  }
}

async function toggle(roomId) {
  if (expanded.value === roomId) { expanded.value = null; return }
  expanded.value = roomId
  detail.value = null
  const room = rooms.value.find((r) => r.id === roomId)
  const meetingIds = (room.meetings || []).map((m) => m.id)
  const [{ data: members }, { data: schedules }] = await Promise.all([
    supabase.from('members').select().eq('room_id', roomId).order('created_at'),
    meetingIds.length
      ? supabase.from('schedules').select('*, attachments(*)').in('meeting_id', meetingIds).order('start_at')
      : Promise.resolve({ data: [] }),
  ])
  detail.value = { members: members || [], schedules: schedules || [] }
}

const schedCount = (memberId) =>
  (detail.value?.schedules || []).filter((s) => s.member_id === memberId).length

function storagePath(url, bucket) {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

async function cleanStorage(fileUrls, photoUrls) {
  const attPaths = fileUrls.map((u) => storagePath(u, 'attachments')).filter(Boolean)
  const photoPaths = photoUrls.map((u) => storagePath(u, 'meeting-photos')).filter(Boolean)
  if (attPaths.length) await supabase.storage.from('attachments').remove(attPaths)
  if (photoPaths.length) await supabase.storage.from('meeting-photos').remove(photoPaths)
}

async function removeRoom(room) {
  if (!confirm(`確定刪除房間 ${room.code}？所有成員、行程、照片都會消失，無法復原！`)) return
  try {
    const meetingIds = (room.meetings || []).map((m) => m.id)
    let fileUrls = []
    let photoUrls = []
    if (meetingIds.length) {
      const { data: meets } = await supabase.from('meetings').select('photo_url').in('id', meetingIds)
      photoUrls = (meets || []).map((m) => m.photo_url).filter(Boolean)
      const { data: scheds } = await supabase.from('schedules').select('id').in('meeting_id', meetingIds)
      const schedIds = (scheds || []).map((s) => s.id)
      const or = [`meeting_id.in.(${meetingIds.join(',')})`]
      if (schedIds.length) or.push(`schedule_id.in.(${schedIds.join(',')})`)
      const { data: atts } = await supabase.from('attachments').select('file_url').or(or.join(','))
      fileUrls = (atts || []).map((a) => a.file_url)
    }
    await cleanStorage(fileUrls, photoUrls)
    await supabase.from('rooms').delete().eq('id', room.id)
    expanded.value = null
    await load()
  } catch (e) {
    error.value = '刪除失敗：' + (e.message || e)
  }
}

async function removeMember(m) {
  const n = schedCount(m.id)
  if (!confirm(`刪除成員「${m.nickname}」${n ? `？他的 ${n} 個行程也會一併刪除` : '？'}`)) return
  await supabase.from('members').delete().eq('id', m.id)
  await toggle(expanded.value)
  await toggle(expanded.value)
  await load()
}

async function removeSchedule(s) {
  if (!confirm(`刪除行程「${s.title}」？`)) return
  const urls = (s.attachments || []).map((a) => a.file_url)
  await cleanStorage(urls, [])
  await supabase.from('schedules').delete().eq('id', s.id)
  const cur = expanded.value
  expanded.value = null
  await toggle(cur)
}

onMounted(() => { if (authed.value) load() })
</script>

<style scoped>
.admin { max-width: 820px; }
.gate { max-width: 360px; margin: 18vh auto 0; padding: 28px; text-align: center; }
.gate h1 { font-size: 20px; margin-bottom: 18px; }
.gate form { display: flex; gap: 10px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
h1 { font-size: 20px; }
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 20px; }
.stat-card { padding: 14px; text-align: center; }
.stat-card b { display: block; font-size: 24px; }
.stat-card span { font-size: 12px; color: var(--text-lo); }
.room-card { margin-bottom: 12px; }
.room-head {
  display: flex; align-items: center; gap: 12px; padding: 14px 18px;
  cursor: pointer; flex-wrap: wrap;
}
.room-code { letter-spacing: 3px; color: var(--accent); }
.room-title { font-weight: 600; }
.room-meta { font-size: 12px; color: var(--text-lo); margin-left: auto; }
.room-arrow { color: var(--text-lo); }
.room-body { padding: 0 18px 16px; }
.room-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.room-actions .pill { text-decoration: none; }
.danger { color: #fca5a5; border-color: rgba(252,165,165,0.4); }
.danger.sm { font-size: 11px; padding: 3px 10px; margin-left: auto; }
.detail h3 { font-size: 13px; color: var(--text-mid); margin: 14px 0 8px; }
.d-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 14px; }
.d-time { font-size: 12px; color: var(--text-mid); font-variant-numeric: tabular-nums; min-width: 80px; }
.d-meta { font-size: 12px; color: var(--text-lo); }
.d-loading { font-size: 13px; color: var(--text-lo); padding: 8px 0; }
.error { color: #fca5a5; font-size: 13px; margin: 10px 0; }
</style>
