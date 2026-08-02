import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

const MEMBER_COLORS = ['#7dd3fc', '#f9a8d4', '#c4b5fd', '#86efac', '#fdba74', '#fca5a5', '#67e8f9', '#d9f99d']
const MAX_FILE_MB = 10
const VAPID_PUBLIC_KEY = 'BIdxHssc7gPPjaLQBUhUi9d3Up7uPTcCjhyzUVlNSFSpQWbeF7ZScd3oAQgvJBvYK9JBRZHm4EBL_IUEbogktfE'

function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

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
    milestones: (s) => s.meeting?.milestones || [],
    nextMilestone() {
      return this.milestones.find((m) => new Date(m.target_at) > new Date()) || null
    },
    journeyDone() {
      return this.milestones.length > 0 && !this.nextMilestone
    },
    countdownTarget() {
      return this.nextMilestone?.target_at || this.meeting?.meet_at || null
    },
  },
  actions: {
    async createRoom({ nickname, title, meetAt }) {
      const code = genCode()
      const { data: room, error: e1 } = await supabase
        .from('rooms').insert({ code }).select().single()
      if (e1) throw e1

      const auth = useAuthStore()
      const { data: member, error: e2 } = await supabase
        .from('members')
        .insert({ room_id: room.id, nickname, color: MEMBER_COLORS[0], user_id: auth.user?.id || null })
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

      const { data: existing } = await supabase
        .from('members').select().eq('room_id', room.id).order('created_at')

      const auth = useAuthStore()

      // 已登入且此房間已有綁定此帳號的成員 → 直接認領
      if (auth.user) {
        const mine = (existing || []).find((m) => m.user_id === auth.user.id)
        if (mine) {
          localStorage.setItem(identityKey(room.code), JSON.stringify({ memberId: mine.id, nickname: mine.nickname }))
          return room.code
        }
      }

      // 同暱稱視為同一人，直接認領，不再新建
      const dup = (existing || []).find(
        (m) => m.nickname.trim().toLowerCase() === nickname.trim().toLowerCase(),
      )
      if (dup) {
        if (auth.user && !dup.user_id) {
          await supabase.from('members').update({ user_id: auth.user.id }).eq('id', dup.id)
        }
        localStorage.setItem(identityKey(room.code), JSON.stringify({ memberId: dup.id, nickname: dup.nickname }))
        return room.code
      }

      const { data: member, error: e2 } = await supabase
        .from('members')
        .insert({
          room_id: room.id, nickname,
          color: MEMBER_COLORS[(existing?.length || 0) % MEMBER_COLORS.length],
          user_id: auth.user?.id || null,
        })
        .select().single()
      if (e2) throw e2

      localStorage.setItem(identityKey(room.code), JSON.stringify({ memberId: member.id, nickname }))
      return room.code
    },

    claimMember(member) {
      localStorage.setItem(
        identityKey(this.room.code),
        JSON.stringify({ memberId: member.id, nickname: member.nickname }),
      )
      this.me = member
      const auth = useAuthStore()
      if (auth.user && !member.user_id) {
        supabase.from('members').update({ user_id: auth.user.id }).eq('id', member.id)
          .then(() => { member.user_id = auth.user.id })
      }
    },

    async myRooms() {
      const auth = useAuthStore()
      if (!auth.user) return []
      const { data } = await supabase
        .from('members')
        .select('nickname, rooms(code, created_at, meetings(title, status))')
        .eq('user_id', auth.user.id)
      return (data || [])
        .filter((m) => m.rooms)
        .map((m) => ({
          code: m.rooms.code,
          nickname: m.nickname,
          title: m.rooms.meetings?.find((x) => x.status === 'active')?.title
            || m.rooms.meetings?.[0]?.title || '',
        }))
    },

    scheduleCountOf(memberId) {
      return this.schedules.filter((s) => s.member_id === memberId).length
    },

    async removeMember(id) {
      if (!this.me || this.room.owner_member_id !== this.me.id) {
        throw new Error('只有房間建立者可以管理成員')
      }
      if (id === this.room.owner_member_id) throw new Error('不能刪除房間建立者')
      if (this.scheduleCountOf(id) > 0) throw new Error('該成員已有行程，不能刪除')
      await supabase.from('members').delete().eq('id', id)
      const { data } = await supabase.from('members').select().eq('room_id', this.room.id).order('created_at')
      this.members = data || []
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
      const [{ data: members }] = await Promise.all([
        supabase.from('members').select().eq('room_id', room.id).order('created_at'),
        this.loadMeeting(room.id),
      ])
      this.members = members || []

      // 身分優先序：帳號綁定 > 本機記錄（並順手把本機身分綁上帳號）
      const auth = useAuthStore()
      this.me = null
      if (auth.user) {
        this.me = (members || []).find((m) => m.user_id === auth.user.id) || null
      }
      if (!this.me && identity) {
        const m = (members || []).find((x) => x.id === identity.memberId) || null
        if (m) {
          this.me = m
          if (auth.user && !m.user_id) {
            supabase.from('members').update({ user_id: auth.user.id }).eq('id', m.id)
              .then(() => { m.user_id = auth.user.id })
          }
        }
      }

      if (this.meeting) await this.loadSchedules()
      this.subscribe()
    },

    async loadMeeting(roomId = this.room?.id) {
      const { data } = await supabase
        .from('meetings').select('*, attachments(*), milestones(*)').eq('room_id', roomId)
        .eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data?.milestones) {
        data.milestones.sort((a, b) => new Date(a.target_at) - new Date(b.target_at))
      }
      this.meeting = data
    },

    async loadSchedules() {
      if (!this.meeting) return
      const { data } = await supabase
        .from('schedules').select('*, attachments(*), schedule_reactions(*)')
        .eq('meeting_id', this.meeting.id).order('start_at')
      const list = data || []
      this.notifyNewlyCompleted(list)
      this.schedules = list
    },

    notifyNewlyCompleted(list) {
      const prev = this._completedMap
      const map = {}
      for (const s of list) map[s.id] = s.completed_at
      if (prev && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const s of list) {
          const wasKnown = s.id in prev
          if (wasKnown && !prev[s.id] && s.completed_at && s.member_id !== this.me?.id) {
            const who = this.members.find((m) => m.id === s.member_id)?.nickname || '成員'
            try {
              new Notification('MeetTime ✓ 行程完成', {
                body: `${who} 完成了「${s.title}」`,
                icon: '/icons/icon-192.png',
              })
            } catch { /* ignore */ }
          }
        }
      }
      this._completedMap = map
    },

    async compressImage(file) {
      if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
      try {
        const img = await createImageBitmap(file)
        const MAX = 1600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
        if (!blob || blob.size >= file.size) return file
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      } catch {
        return file
      }
    },

    async uploadFile(rawFile, folder) {
      const file = await this.compressImage(rawFile)
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`檔案「${file.name}」超過 ${MAX_FILE_MB}MB 上限`)
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${folder}/${crypto.randomUUID()}-${safeName}`
      const { error } = await supabase.storage.from('attachments').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      return data.publicUrl
    },

    async autoTrimNeighbors(scheduleId, startAt, endAt) {
      const s0 = new Date(startAt)
      const s1 = new Date(endAt)
      for (const o of this.schedules) {
        if (o.id === scheduleId) continue
        const os = new Date(o.start_at)
        const oe = new Date(o.end_at)
        if (oe <= s0 || os >= s1) continue
        if (os < s0) {
          // 前行程尾巴被蓋到 → 提早結束
          await supabase.from('schedules').update({ end_at: startAt }).eq('id', o.id)
        } else if (oe > s1) {
          // 後行程開頭被蓋到 → 延後開始
          await supabase.from('schedules').update({ start_at: endAt }).eq('id', o.id)
        }
        // 完全被覆蓋的行程不動（避免變成無效時間），由使用者自行處理
      }
    },

    async saveSchedule({ id, title, startAt, endAt, note, newFiles = [], removeAttachmentIds = [], autoTrim = false }) {
      if (!this.me) throw new Error('請先加入房間')
      let scheduleId = id
      if (id) {
        const { error } = await supabase.from('schedules')
          .update({ title, start_at: startAt, end_at: endAt, note: note || null })
          .eq('id', id).eq('member_id', this.me.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('schedules').insert({
          meeting_id: this.meeting.id,
          member_id: this.me.id,
          title, start_at: startAt, end_at: endAt, note: note || null,
        }).select().single()
        if (error) throw error
        scheduleId = data.id
      }

      for (const file of newFiles) {
        const url = await this.uploadFile(file, `schedules/${scheduleId}`)
        await supabase.from('attachments').insert({
          schedule_id: scheduleId, member_id: this.me.id,
          file_url: url, file_name: file.name, file_type: file.type,
        })
      }
      if (removeAttachmentIds.length) {
        await supabase.from('attachments').delete().in('id', removeAttachmentIds)
      }
      if (autoTrim) await this.autoTrimNeighbors(scheduleId, startAt, endAt)
      await this.loadSchedules()
    },

    async toggleReaction(schedule, emoji) {
      if (!this.me) return
      const existing = (schedule.schedule_reactions || [])
        .find((r) => r.member_id === this.me.id && r.emoji === emoji)
      if (existing) {
        await supabase.from('schedule_reactions').delete().eq('id', existing.id)
      } else {
        await supabase.from('schedule_reactions').insert({
          schedule_id: schedule.id, member_id: this.me.id, emoji,
        })
      }
      await this.loadSchedules()
    },

    async syncMeetAt() {
      const next = this.milestones.find((m) => new Date(m.target_at) > new Date())
      const target = next?.target_at || this.milestones.at(-1)?.target_at
      if (target && target !== this.meeting.meet_at) {
        await supabase.from('meetings').update({ meet_at: target }).eq('id', this.meeting.id)
      }
    },

    async addMilestone({ title, targetAt }) {
      if (!this.me || this.room.owner_member_id !== this.me.id) {
        throw new Error('只有房間建立者可以修改里程碑')
      }
      const { error } = await supabase.from('milestones')
        .insert({ meeting_id: this.meeting.id, title, target_at: targetAt })
      if (error) throw error
      await this.loadMeeting()
      await this.syncMeetAt()
    },

    async removeMilestone(id) {
      if (!this.me || this.room.owner_member_id !== this.me.id) return
      if (this.milestones.length <= 1) throw new Error('至少要保留一個里程碑')
      await supabase.from('milestones').delete().eq('id', id)
      await this.loadMeeting()
      await this.syncMeetAt()
    },

    async updateMilestone({ id, title, targetAt }) {
      if (!this.me || this.room.owner_member_id !== this.me.id) {
        throw new Error('只有房間建立者可以修改里程碑')
      }
      const { error } = await supabase.from('milestones')
        .update({ title, target_at: targetAt }).eq('id', id)
      if (error) throw error
      await this.loadMeeting()
      await this.syncMeetAt()
    },

    async updateMeeting({ title, meetAt }) {
      if (!this.me || this.room.owner_member_id !== this.me.id) {
        throw new Error('只有房間建立者可以修改')
      }
      const { error } = await supabase.from('meetings')
        .update({ title, meet_at: meetAt }).eq('id', this.meeting.id)
      if (error) throw error
      await this.loadMeeting()
    },

    async addScheduleFiles(schedule, files) {
      if (!this.me) return
      for (const file of files) {
        const url = await this.uploadFile(file, `schedules/${schedule.id}`)
        await supabase.from('attachments').insert({
          schedule_id: schedule.id, member_id: this.me.id,
          file_url: url, file_name: file.name, file_type: file.type,
        })
      }
      await this.loadSchedules()
    },

    async toggleComplete(schedule) {
      if (!this.me) return
      const completing = !schedule.completed_at
      await supabase.from('schedules').update({
        completed_at: completing ? new Date().toISOString() : null,
        completed_by: completing ? this.me.id : null,
      }).eq('id', schedule.id)
      await this.loadSchedules()
      if (completing) {
        this.sendPush(`${this.me.nickname} 完成了「${schedule.title}」✓`)
      }
    },

    sendPush(body, title = 'MeetTime') {
      if (!this.room) return
      supabase.functions.invoke('push', {
        body: {
          room_id: this.room.id,
          actor_member_id: this.me?.id,
          title,
          body,
          url: `/r/${this.room.code}`,
        },
      }).catch(() => { /* 推播失敗不影響主流程 */ })
    },

    async subscribePush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('此瀏覽器不支援推播（iPhone 需先加入主畫面再開啟）')
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return perm
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        room_id: this.room.id,
        member_id: this.me?.id || null,
        endpoint: json.endpoint,
        keys: json.keys,
      }, { onConflict: 'endpoint' })
      return 'granted'
    },

    async removeSchedule(id) {
      await supabase.from('schedules').delete().eq('id', id).eq('member_id', this.me?.id)
    },

    async addMeetingFiles(files) {
      if (!this.me || !this.meeting) return
      for (const file of files) {
        const url = await this.uploadFile(file, `meetings/${this.meeting.id}`)
        await supabase.from('attachments').insert({
          meeting_id: this.meeting.id, member_id: this.me.id,
          file_url: url, file_name: file.name, file_type: file.type,
        })
      }
      await this.loadMeeting()
    },

    async removeMeetingAttachment(id) {
      await supabase.from('attachments').delete().eq('id', id)
      await this.loadMeeting()
    },

    async setMeetingPhoto(file) {
      if (!this.meeting) return
      const url = await this.uploadFile(file, `photos/${this.meeting.id}`)
      await supabase.from('meetings')
        .update({ photo_url: url, show_photo: true }).eq('id', this.meeting.id)
      await this.loadMeeting()
    },

    async removeMeetingPhoto() {
      if (!this.meeting) return
      await supabase.from('meetings').update({ photo_url: null }).eq('id', this.meeting.id)
      await this.loadMeeting()
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' },
          async () => { await Promise.all([this.loadSchedules(), this.loadMeeting()]) })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_reactions' },
          () => this.loadSchedules())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' },
          () => this.loadMeeting())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${this.room.id}` },
          async () => {
            const { data } = await supabase.from('members').select().eq('room_id', this.room.id).order('created_at')
            this.members = data || []
          })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `room_id=eq.${this.room.id}` },
          async () => { await this.loadMeeting(); await this.loadSchedules() })
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
