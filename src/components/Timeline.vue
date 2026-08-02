<template>
  <section class="glass timeline">
    <p v-if="!groups.length" class="empty">還沒有行程，點「＋ 新增行程」把等待填滿吧</p>
    <template v-for="g in groups" :key="g.label">
      <div class="day">{{ g.label }}</div>
      <template v-for="item in g.items" :key="item.id">
        <div v-if="item.nowline" class="nowline">
          <time>{{ nowText }}</time>
          <div class="bar" />
        </div>
        <div v-else-if="item.gapAdd" class="gap-row">
          <span />
          <button
            v-if="meId" class="gap-btn" :class="{ squeeze: item.squeeze }"
            @click="$emit('quick-add', { startAt: item.startAt, endAt: item.endAt, autoTrim: item.squeeze })"
          >＋ {{ item.squeeze
            ? `${fmt(item.startAt)} 插入行程（自動壓縮前後）`
            : `${fmt(item.startAt)}–${fmt(item.endAt)} 插入行程` }}</button>
        </div>
        <div v-else class="slot">
          <time>{{ fmt(item.start_at) }}–{{ fmt(item.end_at) }}</time>
          <div
            class="event" :class="{ live: isLive(item), done: item.completed_at }"
            :style="{ '--c': memberColor(item.member_id) }"
          >
            <div class="ev-main">
            <div class="name">
              <button
                v-if="meId"
                class="check" :class="{ checked: item.completed_at }"
                :title="item.completed_at ? '取消完成' : '標記完成'"
                @click="$emit('toggle-complete', item)"
              >{{ item.completed_at ? '✓' : '' }}</button>
              <span v-else-if="item.completed_at" class="check checked static">✓</span>
              <span class="name-text">{{ item.title }}</span>
              <span v-if="item.completed_at" class="badge done-badge">
                ✓ {{ memberName(item.completed_by) }} 達成
              </span>
              <span v-else-if="isLive(item)" class="badge">進行中</span>
            </div>
            <div v-if="fileList(item).length" class="atts">
              <a
                v-for="a in fileList(item)" :key="a.id"
                :href="a.file_url" target="_blank" rel="noopener" class="file-chip"
              >📎 {{ a.file_name }}</a>
            </div>
            <div class="reactions">
              <button
                v-for="e in EMOJIS" :key="e"
                class="react"
                :class="{ mine: mineReacted(item, e), has: reactCount(item, e) > 0 }"
                :disabled="!meId"
                @click="$emit('react', item, e)"
              >{{ e }}<span v-if="reactCount(item, e)" class="rc">{{ reactCount(item, e) }}</span></button>
            </div>
            <div class="who">
              {{ memberName(item.member_id) }}
              <button v-if="meId" class="del" @click="$emit('attach', item)">📷 傳照片</button>
              <button v-if="meId" class="del" @click="$emit('alarm', item)">⏰ 鬧鐘</button>
              <button
                v-if="meId" class="del timer-toggle" :class="{ on: item.show_timer }"
                :title="item.show_timer ? '小組件倒數：開' : '小組件倒數：關'"
                @click="$emit('toggle-timer', item)"
              >⏱ {{ item.show_timer ? '倒數開' : '倒數關' }}</button>
              <button v-if="hasImages(item)" class="del" @click="$emit('share', item)">✨ 美照</button>
              <template v-if="item.member_id === meId">
                <button class="del" @click="$emit('edit', item)">編輯</button>
                <button class="del" @click="$emit('remove', item.id)">刪除</button>
              </template>
            </div>
            </div>
            <div
              v-if="hasImages(item)" class="ev-photos"
              @click="$emit('preview', imageList(item), 0)"
            >
              <img :src="imageList(item)[0].file_url" :alt="imageList(item)[0].file_name" />
              <span v-if="imageList(item).length > 1" class="more">+{{ imageList(item).length - 1 }}</span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { dayjs, dayLabel } from '../lib/time'

const props = defineProps({
  schedules: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  meId: String,
})
defineEmits(['remove', 'edit', 'toggle-complete', 'attach', 'react', 'preview', 'share', 'quick-add', 'alarm', 'toggle-timer'])

const EMOJIS = ['❤️', '👍', '😂', '🎉', '😭']
const isImage = (t) => t && t.startsWith('image/')
const imageList = (item) => (item.attachments || []).filter((a) => isImage(a.file_type))
const fileList = (item) => (item.attachments || []).filter((a) => !isImage(a.file_type))
const hasImages = (item) => imageList(item).length > 0
const reactCount = (item, e) => (item.schedule_reactions || []).filter((r) => r.emoji === e).length
const mineReacted = (item, e) =>
  (item.schedule_reactions || []).some((r) => r.emoji === e && r.member_id === props.meId)

const now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30000) })
onUnmounted(() => clearInterval(timer))

const nowText = computed(() => dayjs(now.value).format('HH:mm'))
const fmt = (d) => dayjs(d).format('HH:mm')

const isLive = (s) => now.value >= +new Date(s.start_at) && now.value < +new Date(s.end_at)

const memberColor = (id) => props.members.find((m) => m.id === id)?.color || 'var(--accent)'
const memberName = (id) => props.members.find((m) => m.id === id)?.nickname || '?'

const groups = computed(() => {
  const byDay = new Map()
  for (const s of props.schedules) {
    const key = dayjs(s.start_at).format('YYYY-MM-DD')
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(s)
  }
  const todayKey = dayjs(now.value).format('YYYY-MM-DD')
  return [...byDay.entries()].map(([key, items]) => {
    const out = []
    let inserted = false
    items.forEach((item, i) => {
      if (i > 0) {
        const prevEnd = items[i - 1].end_at
        const gapMs = new Date(item.start_at) - new Date(prevEnd)
        out.push({
          gapAdd: true,
          id: `gap-${items[i - 1].id}`,
          startAt: prevEnd,
          endAt: gapMs >= 5 * 60 * 1000
            ? item.start_at
            : new Date(+new Date(prevEnd) + 30 * 60 * 1000).toISOString(),
          squeeze: gapMs < 5 * 60 * 1000,
        })
      }
      if (key === todayKey && !inserted && +new Date(item.start_at) > now.value) {
        out.push({ nowline: true, id: 'nowline' })
        inserted = true
      }
      out.push(item)
    })
    if (key === todayKey && !inserted) out.push({ nowline: true, id: 'nowline' })
    return { label: dayLabel(items[0].start_at), items: out }
  })
})
</script>

<style scoped>
.timeline { padding: 22px 20px; }
.empty { text-align: center; color: var(--text-lo); font-size: 14px; padding: 12px 0; }
.day { font-size: 13px; color: var(--text-lo); letter-spacing: 1px; margin: 14px 0 10px; }
.day:first-child { margin-top: 4px; }
.slot { display: grid; grid-template-columns: 86px 1fr; gap: 12px; margin-bottom: 10px; }
.slot time { font-size: 12px; color: var(--text-mid); padding-top: 10px; font-variant-numeric: tabular-nums; }
.event {
  border-radius: 14px; padding: 10px 14px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-left: 3px solid var(--c); border-top-left-radius: 0; border-bottom-left-radius: 0;
  display: flex; gap: 12px; align-items: flex-start;
}
.ev-main { flex: 1; min-width: 0; }
.ev-photos {
  position: relative; flex-shrink: 0; cursor: zoom-in; align-self: center;
}
.ev-photos img {
  width: 74px; height: 74px; object-fit: cover; border-radius: 10px;
  border: 1px solid var(--glass-border); display: block;
}
.ev-photos .more {
  position: absolute; right: 4px; bottom: 4px;
  font-size: 11px; font-weight: 700; color: #fff;
  background: rgba(0,0,0,0.55); padding: 2px 7px; border-radius: 999px;
}
.event .name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.check {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  border: 1.5px solid var(--glass-border); background: var(--glass-bg);
  color: #fff; font-size: 13px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: 0.15s; padding: 0;
}
.check:hover { border-color: var(--accent); }
.check.checked { background: #22c55e; border-color: #22c55e; }
.check.static { cursor: default; }
.event.done { opacity: 0.8; }
.event.done .name-text { text-decoration: line-through; text-decoration-thickness: 1.5px; }
.done-badge {
  background: rgba(34,197,94,0.28) !important;
  animation: none !important;
}
.event .who { font-size: 12px; color: var(--text-lo); margin-top: 2px; display: flex; align-items: center; gap: 8px; }
.event.live { box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 30%, transparent); }
.badge {
  display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--text-hi); margin-left: 6px; animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 50% { opacity: 0.5; } }
.atts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.thumb {
  width: 56px; height: 56px; object-fit: cover; border-radius: 8px;
  border: 1px solid var(--glass-border); display: block; cursor: zoom-in;
}
.reactions { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.react {
  background: none; border: 1px solid transparent; border-radius: 999px;
  font-size: 13px; padding: 2px 7px; cursor: pointer; opacity: 0.35;
  transition: 0.15s; display: inline-flex; align-items: center; gap: 3px;
  font-family: inherit; color: var(--text-mid);
}
.react.has { opacity: 1; background: var(--glass-bg); border-color: var(--glass-border); }
.react.mine { border-color: var(--accent); opacity: 1; }
.react:hover:not(:disabled) { opacity: 1; transform: scale(1.1); }
.react:disabled { cursor: default; }
.rc { font-size: 11px; font-weight: 600; }
.file-chip {
  display: inline-flex; align-items: center; font-size: 12px;
  padding: 5px 10px; border-radius: 999px; max-width: 200px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  color: var(--text-mid); text-decoration: none;
}
.file-chip:hover { color: var(--text-hi); }
.del {
  background: none; border: none; color: var(--text-lo); font-size: 11px;
  cursor: pointer; text-decoration: underline; padding: 0; font-family: inherit;
}
.del:hover { color: #fca5a5; }
.timer-toggle.on { color: var(--accent); font-weight: 600; }
.timer-toggle.on:hover { color: var(--accent); }
.gap-row { display: grid; grid-template-columns: 86px 1fr; gap: 12px; margin: 2px 0 10px; }
.gap-btn {
  border: 1px dashed var(--glass-border); background: none; border-radius: 10px;
  color: var(--text-lo); font-size: 12px; padding: 5px 10px; cursor: pointer;
  font-family: inherit; transition: 0.15s; text-align: center;
}
.gap-btn:hover { color: var(--accent); border-color: var(--accent); }
.nowline { display: grid; grid-template-columns: 86px 1fr; gap: 12px; align-items: center; margin: 6px 0; }
.nowline time { font-size: 12px; color: var(--accent); font-weight: 600; }
.nowline .bar {
  height: 2px; border-radius: 2px; position: relative;
  background: linear-gradient(90deg, var(--accent), transparent);
}
.nowline .bar::before {
  content: ""; position: absolute; left: -4px; top: -3px;
  width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
</style>
