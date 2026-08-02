import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

const KEY = 'meettime:user'
const CRED_KEY = 'meettime:cred'

const encodeCred = (u, p) => btoa(encodeURIComponent(JSON.stringify({ u, p })))
const decodeCred = (raw) => JSON.parse(decodeURIComponent(atob(raw)))

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
      localStorage.setItem(CRED_KEY, encodeCred(username, password))
    },
    async login(username, password) {
      const { data, error } = await supabase.rpc('login_user', {
        p_username: username, p_password: password,
      })
      if (error) throw new Error(cleanError(error))
      this.user = data
      localStorage.setItem(KEY, JSON.stringify(data))
      localStorage.setItem(CRED_KEY, encodeCred(username, password))
    },
    // iOS 有時會清掉網頁儲存：以裝置保存的憑證無感補登
    async tryAutoLogin() {
      if (this.user) return true
      const raw = localStorage.getItem(CRED_KEY)
      if (!raw) return false
      try {
        const { u, p } = decodeCred(raw)
        await this.login(u, p)
        return true
      } catch {
        return false
      }
    },
    logout() {
      this.user = null
      localStorage.removeItem(KEY)
      localStorage.removeItem(CRED_KEY)
    },
  },
})
