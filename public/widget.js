// MeetTime Scriptable widget core（由 loader 自動下載，更新功能不需重貼腳本）
async function makeWidget(roomCode) {
  const SUPABASE_URL = "https://fdinwishjftniiheewob.supabase.co"
  const ANON_KEY = "sb_publishable_yzbAfHHe1Hlt4onJ87W-PA_Gw83Ew6N"
  const headers = { apikey: ANON_KEY, Authorization: "Bearer " + ANON_KEY }

  async function getJSON(path) {
    const req = new Request(SUPABASE_URL + "/rest/v1/" + path)
    req.headers = headers
    return req.loadJSON()
  }

  let meeting = null
  let nextMs = null
  let allDone = false
  let currentSched = null
  let nextSched = null

  if (roomCode) {
    const rooms = await getJSON("rooms?code=eq." + roomCode.toUpperCase() + "&select=id")
    if (rooms.length) {
      const meetings = await getJSON("meetings?room_id=eq." + rooms[0].id +
        "&status=eq.active&select=id,title,meet_at&order=created_at.desc&limit=1")
      meeting = meetings[0] || null
      if (meeting) {
        const ms = await getJSON("milestones?meeting_id=eq." + meeting.id +
          "&select=title,target_at&order=target_at.asc")
        const now = Date.now()
        nextMs = ms.find((m) => new Date(m.target_at) > now) || null
        allDone = ms.length > 0 && !nextMs
        if (!nextMs && !ms.length) nextMs = { title: "", target_at: meeting.meet_at }

        const nowIso = new Date().toISOString()
        currentSched = (await getJSON("schedules?meeting_id=eq." + meeting.id +
          "&start_at=lte." + nowIso + "&end_at=gt." + nowIso +
          "&select=title,start_at,end_at,completed_at,show_timer&order=start_at.desc&limit=1"))[0] || null
        if (!currentSched) {
          nextSched = (await getJSON("schedules?meeting_id=eq." + meeting.id +
            "&start_at=gt." + nowIso +
            "&select=title,start_at,end_at,show_timer&order=start_at.asc&limit=1"))[0] || null
        }
      }
    }
  }

  function hm(d) {
    const x = new Date(d)
    return String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0")
  }

  function remainText(target) {
    const ms = new Date(target) - new Date()
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
    // 行程總標題（大字）
    const t = w.addText(meeting.title)
    t.font = Font.boldSystemFont(17)
    t.textColor = Color.white()
    t.lineLimit = 1
    t.minimumScaleFactor = 0.7

    if (allDone) {
      w.addSpacer(6)
      const r = w.addText("🎉 全部達成！")
      r.font = Font.boldSystemFont(22)
      r.textColor = Color.white()
    } else if (nextMs) {
      if (nextMs.title) {
        w.addSpacer(3)
        const g = w.addText("距離「" + nextMs.title + "」")
        g.font = Font.mediumSystemFont(12)
        g.textColor = new Color("#ffffff", 0.6)
        g.lineLimit = 1
      }
      w.addSpacer(4)
      const remainMs = new Date(nextMs.target_at) - new Date()
      if (remainMs > 0 && remainMs < 86400000) {
        const r = w.addDate(new Date(nextMs.target_at))
        r.applyTimerStyle()
        r.font = Font.boldSystemFont(26)
        r.textColor = Color.white()
        r.minimumScaleFactor = 0.5
        r.lineLimit = 1
      } else {
        const r = w.addText(remainText(nextMs.target_at))
        r.font = Font.boldSystemFont(22)
        r.textColor = Color.white()
        r.minimumScaleFactor = 0.5
      }
      w.addSpacer(4)
      const dt = new Date(nextMs.target_at)
      const dText = w.addText((dt.getMonth() + 1) + "/" + dt.getDate() + " " + hm(dt))
      dText.font = Font.systemFont(11)
      dText.textColor = new Color("#ffffff", 0.5)
    }

    if (currentSched) {
      w.addSpacer(5)
      const c = w.addText("▶ " + (currentSched.completed_at ? "✓ " : "") + currentSched.title)
      c.font = Font.semiboldSystemFont(15)
      c.textColor = new Color("#7dd3fc", 0.98)
      c.lineLimit = 1
      c.minimumScaleFactor = 0.7
      const row = w.addStack()
      row.centerAlignContent()
      const c2 = row.addText(hm(currentSched.start_at) + "–" + hm(currentSched.end_at) +
        (currentSched.show_timer ? "・剩 " : ""))
      c2.font = Font.mediumSystemFont(12)
      c2.textColor = new Color("#7dd3fc", 0.7)
      if (currentSched.show_timer) {
        const c3 = row.addDate(new Date(currentSched.end_at))
        c3.applyTimerStyle()
        c3.font = Font.semiboldSystemFont(12)
        c3.textColor = new Color("#7dd3fc", 0.9)
        c3.lineLimit = 1
      }
    } else if (nextSched) {
      w.addSpacer(5)
      const c = w.addText("接下來 " + nextSched.title)
      c.font = Font.semiboldSystemFont(15)
      c.textColor = new Color("#ffffff", 0.85)
      c.lineLimit = 1
      c.minimumScaleFactor = 0.7
      const row = w.addStack()
      row.centerAlignContent()
      const c2 = row.addText(hm(nextSched.start_at) + " 開始" + (nextSched.show_timer ? "・還有 " : ""))
      c2.font = Font.mediumSystemFont(12)
      c2.textColor = new Color("#ffffff", 0.55)
      if (nextSched.show_timer) {
        const c3 = row.addDate(new Date(nextSched.start_at))
        c3.applyTimerStyle()
        c3.font = Font.semiboldSystemFont(12)
        c3.textColor = new Color("#ffffff", 0.75)
        c3.lineLimit = 1
      }
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
