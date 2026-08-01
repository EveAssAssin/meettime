import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

const MEMBER_COLORS = ['#7dd3fc', '#f9a8d4', '#c4b5fd', '#86efac', '#fdba74', '#fca5a5', '#67e8f9', '#d9f99d']

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const identityKey = (code) => `meettime:identity:${code}`

export const useRoomStore = defineStore('room', {
  state: () => ({
    room: null,
    members: [],
    meeting: null,
    schedules: [],
    me: null,
    channel: null,
  }),
  getters: {
    memberById: (s) => (id) => s.members.find((m) => m.id === id),
  },
  actions: {
    async createRoom({ nickname, title, meetAt }) {
      const code = genCode()
      const { data: room, error: e1 } = await supabase
        .from('rooms').insert({ code }).select().single()
      if (e1) throw e1

      const { data: member, error: e2 } = await supabase
        .from('members')
        .insert({ room_id: room.id, nickname, color: MEMBER_COLORS[0] })
        .select().single()
      if (e2) throw e2

      await supabase.from('rooms').update({ owner_member_id: member.id }).eq('id', room.id)

      const { error: e3 } = await supabase
        .from('meetings')
        .insert({ room_id: room.id, title, meet_at: meetAt })
      if (e3) throw e3

      localStorage.setItem(identityKey(code), JSON.stringify({ memberId: member.id, nickname }))
      return code
    },

    async joinRoom(code, nickname) {
      const { data: room, error } = await supabase
        .from('rooms').select().eq('code', code.toUpperCase()).single()
      if (error || !room) throw new Error('找不到這個房間，請確認房間碼')

      const { count } = await supabase
        .from('members').select('*', { count: 'exact', head: true }).eq('room_id', room.id)

      const { data: member, error: e2 } = await supabase
        .from('members')
        .insert({ room_id: room.id, nickname, color: MEMBER_COLORS[(count || 0) % MEMBER_COLORS.length] })
        .select().single()
      if (e2) throw e2

      localStorage.setItem(identityKey(room.code), JSON.stringify({ memberId: member.id, nickname }))
      return room.code
    },

    getIdentity(code) {
      try {
        return JSON.parse(localStorage.getItem(identityKey(code)))
      } catch {
        return null
      }
    },

    async loadRoom(code) {
      const { data: room, error } = await supabase
        .from('rooms').select().eq('code', code.toUpperCase()).single()
      if (error || !room) throw new Error('找不到這個房間')
      this.room = room

      const identity = this.getIdentity(room.code)
      const [{ data: members }, { data: meeting }] = await Promise.all([
        supabase.from('members').select().eq('room_id', room.id).order('created_at'),
        supabase.from('meetings').select().eq('room_id', room.id).eq('status', 'active')
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      this.members = members || []
      this.meeting = meeting
      this.me = identity ? this.members.find((m) => m.id === identity.memberId) || null : null

      if (meeting) await this.loadSchedules()
      this.subscribe()
    },

    async loadSchedules() {
      if (!this.meeting) return
      const { data } = await supabase
        .from('schedules').select().eq('meeting_id', this.meeting.id).order('start_at')
      this.schedules = data || []
    },

    async addSchedule({ title, startAt, endAt, note }) {
      if (!this.me) throw new Error('請先加入房間')
      const { error } = await supabase.from('schedules').insert({
        meeting_id: this.meeting.id,
        member_id: this.me.id,
        title, start_at: startAt, end_at: endAt, note: note || null,
      })
      if (error) throw error
    },

    async removeSchedule(id) {
      await supabase.from('schedules').delete().eq('id', id).eq('member_id', this.me?.id)
    },

    async setTheme(theme) {
      this.room.theme = theme
      await supabase.from('rooms').update({ theme }).eq('id', this.room.id)
    },

    subscribe() {
      this.unsubscribe()
      this.channel = supabase
        .channel(`room:${this.room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' },
          () => this.loadSchedules())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${this.room.id}` },
          async () => {
            const { data } = await supabase.from('members').select().eq('room_id', this.room.id).order('created_at')
            this.members = data || []
          })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `room_id=eq.${this.room.id}` },
          async () => {
            const { data } = await supabase.from('meetings').select().eq('room_id', this.room.id)
              .eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
            this.meeting = data
            await this.loadSchedules()
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${this.room.id}` },
          (payload) => { this.room = payload.new })
        .subscribe()
    },

    unsubscribe() {
      if (this.channel) supabase.removeChannel(this.channel)
      this.channel = null
    },
  },
})
