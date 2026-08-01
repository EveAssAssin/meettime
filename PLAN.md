# MeetTime — 共用倒數計時器 開發計畫

> 多人共用的倒數計時器：設定目標日期（見面、出國、演唱會…）後開始倒數，
> 所有成員都能在倒數期間填入行程，讓等待的時間被具體的事情填滿。
> 兩人遠距見面是核心情境，但同一套機制支援 N 人共用（例：分享給 3 個朋友一起倒數出國）。

## 一、技術棧

| 項目 | 選擇 |
|---|---|
| 前端 | Vue 3 + Vite + Pinia + Vue Router |
| UI | Tailwind CSS（RWD 手機/桌機並重） |
| 後端 | Supabase（PostgreSQL + Realtime + Edge Functions） |
| 部署 | 前端 Vercel / Netlify，DB 用 Supabase 免費層 |
| 通知 | 瀏覽器 Notification API + PWA（Service Worker） |
| 時間處理 | dayjs（含 timezone plugin，處理兩地時區） |

## 二、核心概念與配對流程

- 無帳號設計：建立者開「房間」→ 產生 6 碼房間碼與分享連結 `/r/:code` → 任何人開啟連結、輸入暱稱即加入，**人數不限**。
- 身分存在 `localStorage`（member_id + 暱稱），同裝置回訪免重新加入。
- 知道房間碼 = 有讀寫權限（RLS 以房間碼驗證），適合私人小群體。
- 每位成員自動配一個顏色（調色盤循環），時間軸與行程列表以顏色+暱稱區分。
- 建立者為 owner，可修改見面日期/標題；行程則人人可新增，各自只能編輯自己的。

## 三、資料模型（Supabase）

```sql
rooms      (id uuid PK, code text UNIQUE, created_at)
members    (id uuid PK, room_id FK, nickname text, color text, created_at)
meetings   (id uuid PK, room_id FK, title text, meet_at timestamptz,
            status text CHECK (active|done|archived), note text, created_at)
schedules  (id uuid PK, meeting_id FK, member_id FK, title text,
            start_at timestamptz, end_at timestamptz, note text, created_at)
```

- 一個 room 可有多個 meetings → 支援「多次見面/活動歷史」。
- 同一時間只有一個 `active` meeting 作為主倒數。
- members 不設人數上限；schedules 以 member 顏色區分，時間軸上一眼看出是誰的行程。
- rooms 增加 `owner_member_id` 欄位標記建立者。
- RLS：全表以 `room code` 為存取條件（透過 RPC 或 header 傳入驗證）。

## 四、頁面規劃

1. **首頁 `/`** — 建立倒數（設定見面日期時間、標題）或輸入房間碼加入。
2. **倒數主頁 `/r/:code`** — 系統核心：
   - 上半：超大字倒數（天/時/分/秒，每秒跳動）。
   - 下半：垂直時間軸，從「現在」到「見面時刻」，雙方行程以色塊呈現，
     「現在線」即時移動，正在進行的行程高亮顯示。
   - 點時間軸空白區段 → 新增行程（標題、起訖時間、備註）；點自己的行程可編輯/刪除。
   - Supabase Realtime 訂閱 schedules/meetings，對方新增行程即時出現。
3. **歷史頁 `/r/:code/history`** — 已完成的見面清單、累積見面次數、
   每次見面的行程回顧；見面時刻到後可一鍵「完成本次見面」並開始下一次倒數。

## 五、關鍵功能設計

### 倒數計時
- 以 server 時間校正（避免裝置時差），`requestAnimationFrame`/`setInterval` 每秒更新。
- 倒數歸零 → 切換為「見面中 🎉」畫面，提供完成/開始下一次按鈕。

### 行程時間軸
- 倒數 <48h：以小時為刻度；>48h：以天為單位分段，點入單日看細節。
- 行程可跨日；重疊行程並排顯示。
- 兩地時區：各自以本地時區顯示，儲存一律 UTC。

### 提醒通知
- 第一版：頁面開啟時的前端提醒（行程開始前 N 分鐘 Notification API）。
- 第二版：Web Push（Service Worker + Supabase Edge Function + pg_cron 排程推播），
  關閉頁面也能收到。

### PWA
- manifest + service worker，可加入手機主畫面，離線顯示最後快取的倒數。

### 桌面/主畫面倒數（依平台分層實作）

| 平台 | 方案 | 效果 | 成本 |
|---|---|---|---|
| 電腦（所有 OS） | 精簡路由 `/r/:code/widget`：只有大字倒數 + 今日行程，用 Chrome/Edge「安裝為應用程式」變成獨立小視窗，釘在工作列 | 一鍵開啟的桌面倒數視窗 | 低，Phase 4 一起做 |
| 電腦（進階） | Tauri 包一個常駐小工具：無邊框、置頂、可拖曳的迷你倒數浮窗 + 系統匣，內嵌 widget 路由 | 真正常駐桌面的倒數 | 中，獨立 Phase |
| Android | PWA 安裝到主畫面（點開即倒數）；真正的桌面 Widget 需原生 App，先不做 | 主畫面圖示秒開 | 低 |
| iPhone | PWA 加入主畫面；進階：提供 JSON API（`GET /api/rooms/:code/summary`），用 Scriptable 寫小組件抓 API 顯示倒數在 iOS 主畫面 | 主畫面小組件顯示剩餘天數 | 低（API）+ 使用者裝 Scriptable |

- 關鍵基礎：做一支公開唯讀 API 回傳 `{title, meet_at, remaining, next_schedule}`，
  之後任何桌面小工具（Scriptable、Rainmeter、KWGT、Tauri）都吃這支 API。
- iOS/Android 原生 Widget（WidgetKit/AppWidget）需要上架原生 App，列為遠期選項。

## 六、開發階段

| Phase | 內容 | 產出 |
|---|---|---|
| 1 | 專案初始化、Supabase schema + RLS、建立/加入房間、倒數主頁大字倒數 | 可共用倒數 |
| 2 | 行程 CRUD + Realtime 同步 + 時間軸視覺化、現在線 | 核心體驗完整 |
| 3 | 多次見面歷史、完成見面流程、統計（累積次數/天數） | 長期使用價值 |
| 4 | 前端通知提醒、PWA、RWD 打磨、`/widget` 精簡路由 + 唯讀 summary API | 上線版 + 桌面倒數基礎 |
| 5 | （進階）Web Push 離線推播、Scriptable iOS 小組件範本、Tauri 桌面浮窗 | 加分項 |

Phase 1–2 為 MVP，預估各 1–2 個工作天。

## 七、視覺設計 — 流光玻璃（Aurora Glassmorphism）

設計稿：`design/mockup.html`（可直接用瀏覽器開啟預覽，開發時以此為視覺基準）。

- **背景**：深藍黑底（#0b0d1a）+ 4 顆大型模糊光暈（靛/桃紅/青/紫），
  `filter: blur(70px)` + `mix-blend-mode: screen`，緩慢漂移動畫營造「流光」。
- **玻璃卡片**：`backdrop-filter: blur(22px) saturate(160%)`、半透明白底
  （rgba 255/0.07）、1px 亮邊框、頂部 inset 高光、24px 圓角，
  加上 7 秒循環的斜向光澤掃過動畫（sheen）。
- **倒數數字**：tabular-nums 等寬數字、白→半透明的漸層文字，避免跳動位移。
- **成員色**：天藍 / 粉 / 紫 / 綠 淺色系調色盤，用於頭像與行程左邊框；
  進行中行程加同色 glow 高亮 + 呼吸燈 badge。
- **時間軸**：時間欄 + 事件卡兩欄 grid，「現在線」為發光藍色橫線即時插入。
- 注意效能：`backdrop-filter` 在低階手機較吃資源，行程卡多時改用純半透明底色。

### 主題系統（可切換背景配色）
- 以 CSS variables 實作，`body[data-theme]` 一鍵切換，五組內建主題：
  深夜流光（預設）、暖陽晚霞、森林霧光、奶油鬆弛（淺色）、櫻花粉嫩（淺色）。
- 淺色主題連動翻轉文字色與玻璃透明度，光暈改 normal blend 呈現柔和感。
- 主題選擇存 rooms 表（房間層級，全員同步）或 localStorage（個人偏好），
  預計採用：房間預設主題 + 個人可覆蓋。

### 倒數照片（可選）
- 見面卡片可上傳一張照片（圓形展示於倒數上方），可隨時開/關顯示。
- 儲存：Supabase Storage bucket `meeting-photos`，meetings 表加
  `photo_url text NULL`、`show_photo boolean DEFAULT true`。
- 上傳時前端壓縮（canvas 縮至 512px）省流量與儲存空間。

## 八、旅程回憶錄（規劃中）

> 概念升級：房間不只是「倒數」，而是一段旅程的完整紀錄。
> 生命週期：等待期（倒數出發）→ 進行期（每天寫行程＋大家傳照片）→ 完成（回憶錄）。

### 8.1 多目標（里程碑）

- 新表 `milestones (id, meeting_id, title, target_at, sort, created_at)`。
  例：日本之旅 → 里程碑1「出發日 8/10」、里程碑2「返家日 8/17」。
- 主倒數自動指向**下一個未到期**的里程碑；已達成的顯示 ✓ 徽章列在倒數下方。
- 全部里程碑過期後 → 旅程進入「已完成」狀態，主畫面轉為回憶錄入口。
- 現有 `meetings.meet_at` 遷移為第一個里程碑，向下相容。

### 8.2 回憶錄模式（持續累積）

- 行程與照片本來就可無限追加——旅程進行中每天新增行程、全員傳照片即可累積。
- 時間軸不因倒數歸零而停止：出發後畫面重點從「倒數」變成「今天的行程」。
- 行程可加「心得」文字（note 欄位已存在，UI 放大顯示），照片牆依日期分組。

### 8.3 回憶錄呈現與輸出（三層）

| 層級 | 內容 | 技術 | 難度 |
|---|---|---|---|
| A. 回憶錄網頁 | `/r/:code/memories`：直式精美時間軸，日期分章、照片瀑布流、心得、達成紀錄，流光玻璃風格，可直接分享連結 | Vue 頁面 | 低 |
| B. 長圖輸出 | 回憶錄頁一鍵輸出直式長圖（適合 IG/LINE 分享）| html-to-image（client 端） | 低中 |
| C. 影片輸出 | 照片幻燈片影片：Ken Burns 縮放特效、日期字卡、可選背景音樂，輸出 mp4/webm | Canvas + MediaRecorder / WebCodecs（client 端，免伺服器） | 中 |

### 8.4 開發順序

1. milestones 資料表 + 多目標倒數 UI + 旅程狀態機（等待/進行/完成）
2. `/memories` 回憶錄網頁
3. 長圖輸出
4. 影片輸出

## 九、專案結構

```
meettime/
├── src/
│   ├── views/        Home.vue / Countdown.vue / History.vue
│   ├── components/   BigTimer.vue / Timeline.vue / ScheduleForm.vue / ScheduleBlock.vue
│   ├── stores/       room.js / schedule.js（Pinia）
│   ├── lib/          supabase.js / time.js
│   └── router/
├── supabase/
│   └── migrations/
└── public/           manifest + icons（PWA）
```
