import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'

dayjs.locale('zh-tw')

export { dayjs }

export function splitRemaining(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t / 3600) % 24),
    m: Math.floor((t / 60) % 60),
    s: t % 60,
  }
}

export const pad = (n) => String(n).padStart(2, '0')

export function dayLabel(date) {
  const d = dayjs(date)
  if (d.isSame(dayjs(), 'day')) return `今天 ${d.format('M/D（dd）')}`
  if (d.isSame(dayjs().add(1, 'day'), 'day')) return `明天 ${d.format('M/D（dd）')}`
  return d.format('M/D（dd）')
}
