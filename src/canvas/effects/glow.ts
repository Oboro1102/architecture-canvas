/**
 * Canvas 2D glow / draw helpers（spec §23）。
 * 所有節點共用——不要各自實作一套 glow。
 */
import type { NodeVisual } from '../Camera'

/** 帶光暈的圓。 */
export function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  blur = 12,
  fillAlpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = fillAlpha
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

/** 帶光暈的線段。 */
export function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1.5,
  blur = 6,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  if (blur > 0) {
    ctx.shadowColor = color
    ctx.shadowBlur = blur
  }
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

export interface RoundedRectOpts {
  borderColor?: string
  borderWidth?: number
  glow?: number
  fill?: string
  radius?: number
}

/** 圓角矩形系統模組卡片（Agent / Core）。 */
export function drawGlowRoundRect(
  ctx: CanvasRenderingContext2D,
  node: NodeVisual,
  opts: RoundedRectOpts,
): void {
  const { x, y, w, h } = node
  const r = opts.radius ?? 10
  ctx.save()
  if (opts.glow && opts.borderColor) {
    ctx.shadowColor = opts.borderColor
    ctx.shadowBlur = opts.glow
  }
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, r)
  if (opts.fill) {
    ctx.fillStyle = opts.fill
    ctx.fill()
  }
  if (opts.borderColor) {
    ctx.strokeStyle = opts.borderColor
    ctx.lineWidth = opts.borderWidth ?? 1.5
    ctx.stroke()
  }
  ctx.restore()
}
