// MeetTime iOS 主畫面小組件（使用 Scriptable App）
// 使用方式：
// 1. App Store 安裝「Scriptable」
// 2. 新增腳本，貼上本檔案內容，把下面 ROOM_CODE 改成你的房間碼
// 3. 主畫面長按 → 加入小組件 → Scriptable → 選這個腳本

const ROOM_CODE = "ABC123" // ← 改成你的房間碼
const SUPABASE_URL = "https://fdinwishjftniiheewob.supabase.co"
const ANON_KEY = "sb_publishable_yzbAfHHe1Hlt4onJ87W-PA_Gw83Ew6N"

async function fetchMeeting() {
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  let req = new Request(`${SUPABASE_URL}/rest/v1/rooms?code=eq.${ROOM_CODE}&select=id`)
  req.headers = headers
  const rooms = await req.loadJSON()
  if (!rooms.length) return null
  req = new Request(
    `${SUPABASE_URL}/rest/v1/meetings?room_id=eq.${rooms[0].id}&status=eq.active&select=title,meet_at&order=created_at.desc&limit=1`
  )
  req.headers = headers
  const meetings = await req.loadJSON()
  return meetings[0] || null
}

function remainText(meetAt) {
  const ms = new Date(meetAt) - new Date()
  if (ms <= 0) return "🎉 時間到了！"
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms / 3600000) % 24)
  const m = Math.floor((ms / 60000) % 60)
  return d > 0 ? `${d} 天 ${h} 小時` : `${h} 小時 ${m} 分`
}

const meeting = await fetchMeeting()
const w = new ListWidget()
const grad = new LinearGradient()
grad.colors = [new Color("#1b1e3c"), new Color("#3c1f45")]
grad.locations = [0, 1]
w.backgroundGradient = grad

if (meeting) {
  const t = w.addText(meeting.title)
  t.font = Font.mediumSystemFont(13)
  t.textColor = new Color("#ffffff", 0.75)
  w.addSpacer(6)
  const r = w.addText(remainText(meeting.meet_at))
  r.font = Font.boldSystemFont(22)
  r.textColor = Color.white()
  r.minimumScaleFactor = 0.5
  w.addSpacer(6)
  const dt = new Date(meeting.meet_at)
  const dText = w.addText(`${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`)
  dText.font = Font.systemFont(11)
  dText.textColor = new Color("#ffffff", 0.5)
} else {
  const t = w.addText("找不到倒數")
  t.textColor = Color.white()
}

w.url = `https://meettime.onrender.com/r/${ROOM_CODE}`
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
Script.setWidget(w)
Script.complete()
