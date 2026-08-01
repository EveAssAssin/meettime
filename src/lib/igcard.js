import { dayjs } from './time'

const THEME_COLORS = {
  midnight: { grad: ['#1b1e3c', '#3c1f45', '#12345c'], light: false },
  sunset: { grad: ['#3b1210', '#57102f', '#4a2a08'], light: false },
  forest: { grad: ['#0a2419', '#12403a', '#123018'], light: false },
  cream: { grad: ['#f5e9d7', '#f7dce8', '#e7e5f7'], light: true },
  sakura: { grad: ['#f9dce8', '#fce4e4', '#f3e2f7'], light: true },
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function drawCover(ctx, img, x, y, w, h, r) {
  ctx.save()
  roundRect(ctx, x, y, w, h, r)
  ctx.clip()
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

export async function makeShareImage({ schedule, doneName, roomTitle, theme = 'midnight' }) {
  const W = 1080
  const H = 1350
  const t = THEME_COLORS[theme] || THEME_COLORS.midnight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, t.grad[0])
  g.addColorStop(0.5, t.grad[1])
  g.addColorStop(1, t.grad[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const glow = (x, y, r, color) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, color)
    rg.addColorStop(1, 'transparent')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)
  }
  glow(W * 0.2, H * 0.15, 500, t.light ? 'rgba(255,255,255,0.5)' : 'rgba(125,211,252,0.16)')
  glow(W * 0.85, H * 0.8, 550, t.light ? 'rgba(255,200,225,0.45)' : 'rgba(249,168,212,0.14)')

  const ink = t.light ? '40,35,30' : '255,255,255'
  const cardX = 60
  const cardY = 70
  const cardW = W - 120
  const cardH = H - 140
  ctx.fillStyle = t.light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.09)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 44)
  ctx.fill()
  ctx.strokeStyle = t.light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 44)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(${ink},0.55)`
  ctx.font = '600 26px "Noto Sans TC", sans-serif'
  ctx.fillText(dayjs(schedule.start_at).format('YYYY/M/D（dd）HH:mm') + '–' + dayjs(schedule.end_at).format('HH:mm'), W / 2, cardY + 78)

  ctx.fillStyle = `rgba(${ink},0.95)`
  ctx.font = '700 58px "Noto Sans TC", sans-serif'
  ctx.fillText(schedule.title, W / 2, cardY + 156, cardW - 100)

  const photos = (schedule.attachments || []).filter((a) => a.file_type && a.file_type.startsWith('image/')).slice(0, 4)
  const px = cardX + 50
  const pTop = cardY + 210
  const pW = cardW - 100
  const pH = 760
  const gap = 16

  const imgs = []
  for (const p of photos) {
    try { imgs.push(await loadImage(p.file_url)) } catch { /* skip */ }
  }

  if (imgs.length === 1) {
    drawCover(ctx, imgs[0], px, pTop, pW, pH, 28)
  } else if (imgs.length === 2) {
    const hw = (pW - gap) / 2
    drawCover(ctx, imgs[0], px, pTop, hw, pH, 28)
    drawCover(ctx, imgs[1], px + hw + gap, pTop, hw, pH, 28)
  } else if (imgs.length === 3) {
    const hw = (pW - gap) / 2
    const hh = (pH - gap) / 2
    drawCover(ctx, imgs[0], px, pTop, hw, pH, 28)
    drawCover(ctx, imgs[1], px + hw + gap, pTop, hw, hh, 28)
    drawCover(ctx, imgs[2], px + hw + gap, pTop + hh + gap, hw, hh, 28)
  } else if (imgs.length >= 4) {
    const hw = (pW - gap) / 2
    const hh = (pH - gap) / 2
    drawCover(ctx, imgs[0], px, pTop, hw, hh, 28)
    drawCover(ctx, imgs[1], px + hw + gap, pTop, hw, hh, 28)
    drawCover(ctx, imgs[2], px, pTop + hh + gap, hw, hh, 28)
    drawCover(ctx, imgs[3], px + hw + gap, pTop + hh + gap, hw, hh, 28)
  } else {
    ctx.fillStyle = `rgba(${ink},0.3)`
    ctx.font = '500 34px "Noto Sans TC", sans-serif'
    ctx.fillText('（沒有照片）', W / 2, pTop + pH / 2)
  }

  let footY = pTop + pH + 90
  if (doneName) {
    const badge = `✓ ${doneName} 達成`
    ctx.font = '600 32px "Noto Sans TC", sans-serif'
    const bw = ctx.measureText(badge).width + 60
    ctx.fillStyle = 'rgba(34,197,94,0.25)'
    roundRect(ctx, (W - bw) / 2, footY - 44, bw, 62, 31)
    ctx.fill()
    ctx.fillStyle = t.light ? 'rgba(20,90,50,0.95)' : 'rgba(190,255,215,0.95)'
    ctx.fillText(badge, W / 2, footY)
    footY += 84
  }

  ctx.fillStyle = `rgba(${ink},0.5)`
  ctx.font = '500 28px "Noto Sans TC", sans-serif'
  ctx.fillText(`${roomTitle} · MeetTime`, W / 2, cardY + cardH - 44)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
