<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="glass modal">
      <h3>新增行程</h3>
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
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" class="pill" @click="$emit('close')">取消</button>
          <button type="submit" class="pill primary" :disabled="loading">
            {{ loading ? '儲存中…' : '加入行程' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { dayjs } from '../lib/time'

const emit = defineEmits(['close', 'save'])

const title = ref('')
const startAt = ref(dayjs().add(1, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm'))
const endAt = ref(dayjs().add(2, 'hour').startOf('hour').format('YYYY-MM-DDTHH:mm'))
const note = ref('')
const loading = ref(false)
const error = ref('')

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
        title: title.value.trim(),
        startAt: new Date(startAt.value).toISOString(),
        endAt: new Date(endAt.value).toISOString(),
        note: note.value.trim(),
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
.modal { width: 100%; max-width: 420px; padding: 24px; }
h3 { font-size: 17px; margin-bottom: 6px; }
label { display: block; font-size: 13px; color: var(--text-mid); margin: 14px 0 6px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.error { margin-top: 12px; font-size: 13px; color: #fca5a5; }
@media (max-width: 460px) { .row { grid-template-columns: 1fr; } }
</style>
