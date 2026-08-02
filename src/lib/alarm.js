import { dayjs } from './time'

export const IOS_SHORTCUT_NAME = 'MeetTime鬧鐘'

export function platform() {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  return 'desktop'
}

export function androidAlarmUrl(date, label) {
  const d = new Date(date)
  return 'intent:#Intent;action=android.intent.action.SET_ALARM;' +
    `i.android.intent.extra.alarm.HOUR=${d.getHours()};` +
    `i.android.intent.extra.alarm.MINUTES=${d.getMinutes()};` +
    `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};` +
    'B.android.intent.extra.alarm.SKIP_UI=false;end'
}

export function iosShortcutUrl(date, label) {
  const time = dayjs(date).format('HH:mm')
  const input = `${time}|${label}`
  return `shortcuts://run-shortcut?name=${encodeURIComponent(IOS_SHORTCUT_NAME)}` +
    `&input=text&text=${encodeURIComponent(input)}`
}

export function downloadIcs(date, endDate, label) {
  const fmt = (d) => dayjs(d).format('YYYYMMDDTHHmmss')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetTime//TW',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@meettime`,
    `DTSTART:${fmt(date)}`,
    `DTEND:${fmt(endDate || new Date(+new Date(date) + 15 * 60000))}`,
    `SUMMARY:${label}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${label}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'meettime-alarm.ics'
  a.click()
  URL.revokeObjectURL(a.href)
}
