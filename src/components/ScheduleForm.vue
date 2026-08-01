<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="glass modal">
      <h3>{{ schedule ? '編輯行程' : '新增行程' }}</h3>
      <form @submit.prevent="submit">
        <label>要做什麼</label>
        <input v-model="title" class="field" placeholder="例如：高鐵北上、睡覺充電" required maxlength="30" />
        <div class="row">
          <div>
            <label>開始</label>
            <input v-model="startAt" class="field" type="datetime-local" required />
          </div>
          <div>
            <label>結束</label>
            <input v-model="endAt" class="field" type="datetime-local" required />
          </div>
        </div>
        <label>備註（選填）</label>
        <input v-model="note" class="field" maxlength="100" />

        <label>附件（圖片或檔案，單檔 10MB 內）</label>
        <div class="att-list">
          <div v-for="a in keptAttachments" :key="a.id" class="att-chip">
            <img v-if="isImage(a.file_type)" :src="a.file_url" alt="" />
            <span v-else>📎</span>
            <em>{{ a.file_name }}</em>
            <button type="button" @click="removeIds.push(a.id)">✕</button>
          </div>
          <div v-for="(f, i) in newFiles" :key="`new-${i}`" class="att-chip new">
            <span>{{ f.type.startsWith('image/') ? '🖼️' : '📎' }}</span>
            <em>{{ f.name }}</em>
            <button type="button" @click="newFiles.splice(i, 1)">✕</button>
          </div>
          <button type="button" class="pill add-file" @click="fileInput.click()">＋ 加入檔案</button>
          <input ref="fileInput" type="file" multiple hidden @change="onPick" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" class="pill" @click="$emit('close')">取消</button>
          <button type="submit" class="pill primary" :disabled="loading">
            {{ loading ? '儲存中…' : (schedule ? '儲存修改' : '加入行程') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { dayjs } from '../lib/time'

const props = defineProps({ schedule: { type: Object, default: null } })
const emit = defineEmits(['close', 'save'])

const toLocal = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm')

const title = ref(props.schedule?.title || '')
const startAt = ref(props.schedule ? toLocal(props.schedule.start_at) : dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm'))
const endAt = ref(props.schedule ? toLocal(props.schedule.end_at) : dayjs().add(2, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm'))
const note = ref(props.schedule?.note || '')
const newFiles = ref([])
const removeIds = ref([])
const fileInput = ref()
const loading = ref(false)
const error = ref('')

const keptAttachments = computed(() =>
  (props.schedule?.attachments || []).filter((a) => !removeIds.value.includes(a.id)))

const isImage = (t) => t && t.startsWith('image/')

function onPick(e) {
  newFiles.value.push(...e.target.files)
  e.target.value = ''
}

async function submit() {
  if (new Date(endAt.value) <= new Date(startAt.value)) {
    error.value = '結束時間要在開始時間之後'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await new Promise((resolve, reject) => {
      emit('save', {
        id: props.schedule?.id,
        title: title.value.trim(),
        startAt: new Date(startAt.value).toISOString(),
        endAt: new Date(endAt.value).toISOString(),
        note: note.value.trim(),
        newFiles: [...newFiles.value],
        removeAttachmentIds: [...removeIds.value],
        resolve, reject,
      })
    })
    emit('close')
  } catch (e) {
    error.value = e.message || '儲存失敗'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 10;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal { width: 100%; max-width: 440px; padding: 24px; max-height: 90vh; overflow-y: auto; }
h3 { font-size: 17px; margin-bottom: 6px; }
label { display: block; font-size: 13px; color: var(--text-mid); margin: 14px 0 6px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.row .field {
  min-width: 0; width: 100%;
  padding: 12px 8px; font-size: 13px;
}
.row .field::-webkit-calendar-picker-indicator { margin: 0; }
.att-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.att-chip {
  display: flex; align-items: center; gap: 6px; max-width: 100%;
  padding: 6px 10px; border-radius: 10px; font-size: 12px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
}
.att-chip img { width: 28px; height: 28px; object-fit: cover; border-radius: 6px; }
.att-chip em {
  font-style: normal; max-width: 140px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.att-chip button {
  background: none; border: none; color: var(--text-lo); cursor: pointer;
  font-size: 12px; padding: 0 2px;
}
.att-chip button:hover { color: #fca5a5; }
.add-file { font-size: 12px; padding: 6px 12px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.error { margin-top: 12px; font-size: 13px; color: #fca5a5; }
@media (max-width: 460px) { .row { grid-template-columns: 1fr; } }
</style>
