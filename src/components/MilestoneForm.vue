<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="glass modal">
      <h3>⚑ 里程碑目標</h3>
      <p class="hint">倒數會自動指向下一個未到的目標</p>

      <div v-for="m in milestones" :key="m.id" class="ms-row" :class="{ passed: isPassed(m) }">
        <template v-if="editingId === m.id">
          <div class="edit-fields">
            <input v-model="editTitle" class="field" maxlength="20" />
            <input v-model="editTargetAt" class="field" type="datetime-local" />
            <div class="edit-actions">
              <button class="pill sm" @click="editingId = null">取消</button>
              <button class="pill sm primary" :disabled="loading" @click="saveEdit(m)">儲存</button>
            </div>
          </div>
        </template>
        <template v-else>
          <span class="ms-status">{{ isPassed(m) ? '✓' : '•' }}</span>
          <div class="ms-info">
            <b>{{ m.title }}</b>
            <span>{{ fmt(m.target_at) }}</span>
          </div>
          <button class="del" @click="startEdit(m)">編輯</button>
          <button class="del" @click="$emit('remove', m.id)">刪除</button>
        </template>
      </div>

      <form class="add-form" @submit.prevent="add">
        <input v-model="title" class="field" placeholder="目標名稱（例如：返家日）" required maxlength="20" />
        <input v-model="targetAt" class="field" type="datetime-local" required />
        <button type="submit" class="pill primary" :disabled="loading">＋ 新增目標</button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button class="pill" @click="$emit('close')">完成</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { dayjs } from '../lib/time'

defineProps({ milestones: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'add', 'remove', 'update'])

const title = ref('')
const targetAt = ref('')
const loading = ref(false)
const error = ref('')
const editingId = ref(null)
const editTitle = ref('')
const editTargetAt = ref('')

function startEdit(m) {
  editingId.value = m.id
  editTitle.value = m.title
  editTargetAt.value = dayjs(m.target_at).format('YYYY-MM-DDTHH:mm')
}

async function saveEdit(m) {
  loading.value = true
  error.value = ''
  try {
    await new Promise((resolve, reject) => {
      emit('update', {
        id: m.id,
        title: editTitle.value.trim(),
        targetAt: new Date(editTargetAt.value).toISOString(),
        resolve, reject,
      })
    })
    editingId.value = null
  } catch (e) {
    error.value = e.message || '儲存失敗'
  } finally {
    loading.value = false
  }
}

const fmt = (d) => dayjs(d).format('YYYY/M/D（dd）HH:mm')
const isPassed = (m) => new Date(m.target_at) <= new Date()

async function add() {
  loading.value = true
  error.value = ''
  try {
    await new Promise((resolve, reject) => {
      emit('add', {
        title: title.value.trim(),
        targetAt: new Date(targetAt.value).toISOString(),
        resolve, reject,
      })
    })
    title.value = ''
    targetAt.value = ''
  } catch (e) {
    error.value = e.message || '新增失敗'
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
.modal { width: 100%; max-width: 420px; padding: 24px; max-height: 90vh; overflow-y: auto; }
h3 { font-size: 17px; margin-bottom: 4px; }
.hint { font-size: 12px; color: var(--text-lo); margin-bottom: 16px; }
.ms-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px; margin-bottom: 8px;
  background: var(--glass-bg); border: 1px solid var(--glass-border);
}
.ms-row.passed { opacity: 0.6; }
.ms-status { color: var(--accent); font-weight: 700; }
.ms-row.passed .ms-status { color: #22c55e; }
.ms-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ms-info b { font-size: 14px; }
.ms-info span { font-size: 12px; color: var(--text-mid); }
.del {
  background: none; border: none; color: var(--text-lo); font-size: 11px;
  cursor: pointer; text-decoration: underline; font-family: inherit;
}
.del:hover { color: #fca5a5; }
.add-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.edit-fields { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.edit-actions { display: flex; gap: 8px; justify-content: flex-end; }
.pill.sm { font-size: 12px; padding: 5px 14px; }
.actions { display: flex; justify-content: flex-end; margin-top: 18px; }
.error { margin-top: 10px; font-size: 13px; color: #fca5a5; }
</style>
