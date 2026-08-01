// MeetTime 小組件載入器 — 貼這一段就好，之後功能更新都不用重貼
// 房間碼不用寫在這裡：主畫面長按小組件 → 編輯小組件 → Parameter 填房間碼
const code = await new Request("https://meettime.onrender.com/widget.js").loadString()
const makeWidget = new Function(code + "; return makeWidget;")()
const w = await makeWidget(args.widgetParameter || "")
Script.setWidget(w)
if (config.runsInApp) await w.presentSmall()
Script.complete()
