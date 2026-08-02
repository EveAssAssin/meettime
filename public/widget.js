// MeetTime Scriptable widget core（由 loader 自動下載，更新功能不需重貼腳本）
async function makeWidget(roomCode) {
  const SUPABASE_URL = "https://fdinwishjftniiheewob.supabase.co"
  const ANON_KEY = "sb_publishable_yzbAfHHe1Hlt4onJ87W-PA_Gw83Ew6N"
  const headers = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY }

  let meeting = null
  let currentSched = null
  let nextSched = null
  if (roomCode) {
    let req = new Request(SUPABASE_URL + "/rest/v1/rooms?code=eq." + roomCode.toUpperCase() + "&select=id")
    req.headers = headers
    const rooms = await req.loadJSON()
    if (rooms.length) {
      req = new Request(SUPABASE_URL + "/rest/v1/meetings?room_id=eq." + rooms[0].id +
        "&status=eq.active&select=id,title,meet_at&order=created_at.desc&limit=1")
      req.headers = headers
      const meetings = await req.loadJSON()
      meeting = meetings[0] || null
      if (meeting) {
        const nowIso = new Date().toISOString()
        req = new Request(SUPABASE_URL + "/rest/v1/schedules?meeting_id=eq." + meeting.id +
          "&start_at=lte." + nowIso + "&end_at=gt." + nowIso +
          "&select=title,start_at,end_at,completed_at&order=start_at.desc&limit=1")
        req.headers = headers
        currentSched = (await req.loadJSON())[0] || null
        if (!currentSched) {
          req = new Request(SUPABASE_URL + "/rest/v1/schedules?meeting_id=eq." + meeting.id +
            "&start_at=gt." + nowIso +
            "&select=title,start_at,end_at&order=start_at.asc&limit=1")
          req.headers = headers
          nextSched = (await req.loadJSON())[0] || null
        }
      }
    }
  }

  function hm(d) {
    const x = new Date(d)
    return String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0")
  }

  function remainText(meetAt) {
    const ms = new Date(meetAt) - new Date()
    if (ms <= 0) return "🎉 時間到了！"
    const d = Math.floor(ms / 86400000)
    const h = Math.floor((ms / 3600000) % 24)
    const m = Math.floor((ms / 60000) % 60)
    return d > 0 ? d + " 天 " + h + " 小時" : h + " 小時 " + m + " 分"
  }

  const w = new ListWidget()
  const grad = new LinearGradient()
  grad.colors = [new Color("#1b1e3c"), new Color("#3c1f45")]
  grad.locations = [0, 1]
  w.backgroundGradient = grad

  if (!roomCode) {
    const t = w.addText("長按小組件 → 編輯\nParameter 填房間碼")
    t.font = Font.systemFont(13)
    t.textColor = Color.white()
  } else if (meeting) {
    const t = w.addText(meeting.title)
    t.font = Font.mediumSystemFont(13)
    t.textColor = new Color("#ffffff", 0.75)
    t.lineLimit = 1
    w.addSpacer(6)
    const remainMs = new Date(meeting.meet_at) - new Date()
    if (remainMs > 0 && remainMs < 86400000) {
      // 24 小時內：系統動態倒數，秒級即時跳動、免刷新
      const r = w.addDate(new Date(meeting.meet_at))
      r.applyTimerStyle()
      r.font = Font.boldSystemFont(26)
      r.textColor = Color.white()
      r.minimumScaleFactor = 0.5
      r.lineLimit = 1
    } else {
      const r = w.addText(remainText(meeting.meet_at))
      r.font = Font.boldSystemFont(22)
      r.textColor = Color.white()
      r.minimumScaleFactor = 0.5
    }
    w.addSpacer(6)
    const dt = new Date(meeting.meet_at)
    const dText = w.addText((dt.getMonth() + 1) + "/" + dt.getDate() + " " + hm(dt))
    dText.font = Font.systemFont(11)
    dText.textColor = new Color("#ffffff", 0.5)

    if (currentSched) {
      w.addSpacer(5)
      const c = w.addText("▶ " + (currentSched.completed_at ? "✓ " : "") + currentSched.title)
      c.font = Font.semiboldSystemFont(15)
      c.textColor = new Color("#7dd3fc", 0.98)
      c.lineLimit = 1
      c.minimumScaleFactor = 0.7
      const row = w.addStack()
      row.centerAlignContent()
      const c2 = row.addText(hm(currentSched.start_at) + "–" + hm(currentSched.end_at) + "・剩 ")
      c2.font = Font.mediumSystemFont(12)
      c2.textColor = new Color("#7dd3fc", 0.7)
      const c3 = row.addDate(new Date(currentSched.end_at))
      c3.applyTimerStyle()
      c3.font = Font.semiboldSystemFont(12)
      c3.textColor = new Color("#7dd3fc", 0.9)
      c3.lineLimit = 1
    } else if (nextSched) {
      w.addSpacer(5)
      const c = w.addText("接下來 " + nextSched.title)
      c.font = Font.semiboldSystemFont(15)
      c.textColor = new Color("#ffffff", 0.85)
      c.lineLimit = 1
      c.minimumScaleFactor = 0.7
      const c2 = w.addText(hm(nextSched.start_at) + " 開始")
      c2.font = Font.mediumSystemFont(12)
      c2.textColor = new Color("#ffffff", 0.55)
    }
    w.url = "https://meettime.onrender.com/r/" + roomCode.toUpperCase()
  } else {
    const t = w.addText("找不到倒數，確認房間碼")
    t.font = Font.systemFont(13)
    t.textColor = Color.white()
  }

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)
  return w
}
