# MeetTime — 共用倒數計時器

多人共用的倒數計時器：設定目標日期後開始倒數，所有成員可在等待期間填入行程。
流光玻璃（Aurora Glassmorphism）介面，五組可切換主題。

## 開發環境

```bash
npm install
cp .env.example .env   # 填入 Supabase URL 與 anon key
npm run dev
```

## Supabase 設定

1. 在 [supabase.com](https://supabase.com) 建立專案（免費層即可）
2. SQL Editor 執行 `supabase/migrations/0001_init.sql`
3. 專案 Settings → API 取得 URL 與 anon key，填入 `.env`

## 部署

`npm run build` 產出 `dist/`，部署至 Vercel / Netlify。
SPA 需設定 rewrite：所有路徑導向 `index.html`。

## 放到桌面倒數

- **手機（Android/iPhone）**：用瀏覽器開房間頁 → 分享/選單 → 「加入主畫面」，
  會以 App 形式全螢幕開啟（PWA）。
- **電腦（Chrome/Edge）**：開 `https://meettime.onrender.com/r/房間碼/widget`
  （精簡倒數視窗）→ 網址列右側「安裝」→ 變成獨立小視窗，可釘選工作列。
- **iPhone 主畫面小組件**：安裝 Scriptable，貼上 `extras/scriptable-widget.js`
  並改房間碼，即可在主畫面直接顯示剩餘時間。

詳細規劃見 `PLAN.md`，視覺設計稿見 `design/mockup.html`。
