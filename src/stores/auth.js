import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

const KEY = 'meettime:user'

function cleanError(error) {
  const msg = error?.message || '發生錯誤'
  return msg.replace(/^.*?exception\s*/i, '')
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem(KEY) || 'null'),
  }),
  actions: {
    async register(username, password) {
      const { data, error } = await supabase.rpc('register_user', {
        p_username: username, p_password: password,
      })
      if (error) throw new Error(cleanError(error))
      this.user = data
      localStorage.setItem(KEY, JSON.stringify(data))
    },
    async login(username, password) {
      const { data, error } = await supabase.rpc('login_user', {
        p_username: username, p_password: password,
      })
      if (error) throw new Error(cleanError(error))
      this.user = data
      localStorage.setItem(KEY, JSON.stringify(data))
    },
    logout() {
      this.user = null
      localStorage.removeItem(KEY)
    },
  },
})
