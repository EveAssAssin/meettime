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

詳細規劃見 `PLAN.md`，視覺設計稿見 `design/mockup.html`。
