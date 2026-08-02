<template>
  <div class="aurora"><span class="a1" /><span class="a2" /><span class="a3" /><span class="a4" /></div>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

onMounted(() => {
  useAuthStore().tryAutoLogin()
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
})
</script>
