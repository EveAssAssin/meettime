<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="glass modal">
      <h3>修改倒數目標</h3>
      <form @submit.prevent="submit">
        <label>倒數標題</label>
        <input v-model="title" class="field" required maxlength="30" />
        <label>目標日期時間</label>
        <input v-model="meetAt" class="field" type="datetime-local" required />
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" class="pill" @click="$emit('close')">取消</button>
          <button type="submit" class="pill primary" :disabled="loading">
            {{ loading ? '儲存中…' : '儲存修改' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { dayjs } from '../lib/time'

const props = defineProps({ meeting: { type: Object, required: true } })
const emit = defineEmits(['close', 'save'])

const title = ref(props.meeting.title)
const meetAt = ref(dayjs(props.meeting.meet_at).format('YYYY-MM-DDTHH:mm'))
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await new Promise((resolve, reject) => {
      emit('save', {
        title: title.value.trim(),
        meetAt: new Date(meetAt.value).toISOString(),
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
.modal { width: 100%; max-width: 400px; padding: 24px; }
h3 { font-size: 17px; margin-bottom: 6px; }
label { display: block; font-size: 13px; color: var(--text-mid); margin: 14px 0 6px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.error { margin-top: 12px; font-size: 13px; color: #fca5a5; }
</style>
