/**
 * V3 視覺層 — AI Company Neural Workflow（Canvas 2D engine）。
 *
 * 「看起來像 AI 公司神經系統正在運轉」：深色背景＋細微漂移粒子、
 * Agent 圓角系統模組卡片、Tool 圓形節點、細藍連線、
 * 橘黃色資料粒子沿曲線流動（glow + trail）。
 *
 * 架構原則：
 * - Framework-free：Vue wrapper 餵狀態快照與 WorkflowEvent，收 hover/click。
 * - 單一 rAF loop；update(dt) / render() 分離。
 * - 重用現有 ORG_CHART / STATUS_VISUAL domain model，不建第二套。
 * - 不認得任何 LLM provider——只消費 WorkflowEvent。
 */

import { ORG_CHART, ORG_EDGES, STATUS_VISUAL } from '@/types/landing'
import type { LandingAgentStatus } from '@/types/landing'
import {
  CAMERA_LIMITS,
  clampZoom,
  screenToWorld,
  worldToScreen,
} from './Camera'
import type { Camera2D } from './Camera'
import type { NodeVisual } from './Camera'
import type { WorkflowEvent } from './types/workflow'
import { drawGlowCircle, drawGlowRoundRect } from './effects/glow'

export interface EngineCallbacks {
  onHover: (id: string | null, sx: number, sy: number) => void
  onClick: (id: string) => void
}

// ── 色彩系統（spec §6）：藍為主、橘只給流動資料 ──
const C = {
  bg: '#05070b',
  netLine: 'rgba(59,92,160,0.35)',
  nodeBorder: 'rgba(96,140,220,0.55)',
  cardFill: 'rgba(10,16,30,0.88)',
  textDim: 'rgba(150,175,215,0.85)',
  textBright: 'rgba(210,228,255,0.95)',
  flow: '#fbbf24', // 流動資料＝琥珀
  flowHot: '#f97316',
  cyan: '#67e8f9',
}

type EntityKind = 'agent'

interface Entity extends NodeVisual {
  kind: EntityKind
  label: string
  statusKey: string // 對應 LandingAgentStatus 的來源 id
  /** 狀態色平滑插值的目前顯示色（避免切換瞬跳） */
  cr: number
  cg: number
  cb: number
}

interface Connection {
  a: string // entity id
  b: string
  /** 控制點偏移（世界座標法線方向） */
  bowX: number
  bowY: number
}

interface Particle {
  connIdx: number
  t: number
  speed: number
  size: number
  hot: boolean
}

interface Pulse {
  entityId: string
  age: number
  color: string
}

interface BgParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

const AGENT_W = 128
const AGENT_H = 56

/** 效能分級（spec §28）。 */
function perfTier(): 'high' | 'medium' | 'low' {
  if (typeof navigator === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency ?? 4
  const w = window.innerWidth
  if (cores <= 4 || w < 640) return 'low'
  if (cores <= 8 || w < 1024) return 'medium'
  return 'high'
}

export class CompanyEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private entities = new Map<string, Entity>()
  private connections: Connection[] = []
  private particles: Particle[] = []
  private pulses: Pulse[] = []
  private bgParticles: BgParticle[] = []
  private cam: Camera2D = { x: 0, y: -20, zoom: 1 }
  private statuses = new Map<string, LandingAgentStatus>()
  private hoveredId: string | null = null
  private focusedId: string | null = null
  private spotlightId: string | null = null
  private lastFrameTime = 0
  private raf = 0
  private ro: ResizeObserver
  private reducedMotion: boolean
  private disposed = false
  private width = 800
  private height = 600
  private dpr = 1
  private tier: ReturnType<typeof perfTier>
  private pointer = { x: -999, y: -999, down: false, lastX: 0, lastY: 0, moved: false }

  constructor(
    private container: HTMLElement,
    private callbacks: EngineCallbacks,
  ) {
    this.reducedMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    this.tier = perfTier()

    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D not supported')
    this.ctx = ctx

    this.buildGraph()
    this.resize()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    window.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('pointerleave', this.onPointerLeave)
    this.animate()
  }

  // ───────────────────────── graph layout ──

  /**
   * Semantic layout（spec §32–33）：Core 居中偏上，Agent 錯落環繞，
   * Tool 掛在自己 Agent 附近。非規則 grid，有錯落與局部 cluster。
   */
  private buildGraph(): void {
    // Agent 佈局：依 EXECUTION_ORDER 排成蜿蜒的視覺流（spec §41 執行順序），
    // 視線由上往下沿「ceo → product → designer → frontend → backend → qa」
    // 蛇行推進；cto 是 frontend/backend 的主管，掛在右側分支。
    const agentPos: Record<string, [number, number]> = {
      ceo: [0, -230],
      product: [-250, -100],
      designer: [40, 10],
      // cto：frontend/backend 的主管，放在分支起點右側
      cto: [270, 90],
      frontend: [-170, 120],
      backend: [140, 220],
      qa: [-40, 340],
    }
    for (const n of ORG_CHART) {
      const [x, y] = agentPos[n.id] ?? [n.x * 200, n.y * 120]
      this.entities.set(n.id, {
        id: n.id,
        kind: n.id === 'ceo' ? 'agent' : 'agent',
        label: `${n.id}-agent`,
        x,
        y,
        w: AGENT_W,
        h: AGENT_H,
        statusKey: n.id,
        cr: 0.55,
        cg: 0.56,
        cb: 0.64,
      })
    }
    for (const [a, b] of ORG_EDGES) {
      this.addConnection(a, b)
    }

    this.spawnParticles()
  }

  private addConnection(a: string, b: string): void {
    const ea = this.entities.get(a)
    const eb = this.entities.get(b)
    if (!ea || !eb) return
    const dx = eb.x - ea.x
    const dy = eb.y - ea.y
    const len = Math.hypot(dx, dy) || 1
    // 法線外推，彎向遠離原點的一側 → 神經網路般的弧線
    const nx = -dy / len
    const ny = dx / len
    const mx = (ea.x + eb.x) / 2
    const my = (ea.y + eb.y) / 2
    const side = mx * nx + my * ny >= 0 ? 1 : -1
    const bow = len * 0.14 * side
    this.connections.push({ a, b, bowX: nx * bow, bowY: ny * bow })
  }

  /** 背景漂移粒子（spec §5）+ 資料粒子池（spec §26 pooling）。 */
  private spawnParticles(): void {
    const bgCount = this.tier === 'low' ? 40 : this.tier === 'medium' ? 70 : 110
    this.bgParticles = []
    for (let i = 0; i < bgCount; i++) {
      this.bgParticles.push({
        x: Math.random() * 2200 - 1100,
        y: Math.random() * 1500 - 750,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        alpha: 0.05 + Math.random() * 0.12,
        size: 0.6 + Math.random() * 1.2,
      })
    }
    const pCount =
      this.tier === 'low' ? 60 : this.tier === 'medium' ? 100 : 150
    this.particles = []
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        connIdx: i % this.connections.length,
        t: Math.random(),
        speed: 0.05 + Math.random() * 0.06,
        size: 1.6 + Math.random() * 1.6,
        hot: false,
      })
    }
  }

  // ─────────────────────────── public API ──

  setStatuses(map: Record<string, LandingAgentStatus>): void {
    this.statuses.clear()
    for (const [k, v] of Object.entries(map)) this.statuses.set(k, v)
  }

  setHovered(id: string | null): void {
    this.hoveredId = id
  }

  /** Spotlight — 由 store 的 currentStepId 驅動（wrapper 轉接）。 */
  setSpotlight(id: string | null): void {
    this.spotlightId = id
  }

  setFocused(id: string | null): void {
    this.focusedId = id
    if (id) this.focusOn(id)
  }

  /** 消費 WorkflowEvent（spec §29–30）——Mock/Real 共用入口。 */
  handleEvent(evt: WorkflowEvent): void {
    switch (evt.type) {
      case 'data-flow':
      case 'tool-call': {
        // 在 source→target 連線上注入一顆熱粒子
        const idx = this.connections.findIndex(
          (c) =>
            (c.a === evt.sourceId && c.b === evt.targetId) ||
            (c.b === evt.sourceId && c.a === evt.targetId),
        )
        if (idx >= 0 && !this.reducedMotion) {
          const pool = this.particles.find((p) => !p.hot)
          if (pool) {
            pool.connIdx = idx
            pool.t = 0
            pool.hot = true
            pool.speed = 0.45
          }
        }
        break
      }
      case 'task-start':
      case 'agent-start':
      case 'agent-complete':
        this.pulseAt(evt.sourceId, evt.type === 'agent-complete' ? '#34d399' : C.flow)
        break
      default:
        break
    }
  }

  pulseAt(entityId: string, color?: string): void {
    if (this.reducedMotion) return
    const e = this.entities.get(entityId)
    if (!e) return
    const st = this.statuses.get(e.statusKey)
    const col =
      color ??
      `#${STATUS_VISUAL[st ?? 'idle'].color.toString(16).padStart(6, '0')}`
    this.pulses.push({ entityId, age: 0, color: col })
  }

  focusOn(id: string): void {
    const e = this.entities.get(id)
    if (!e) return
    this.cam.x = e.x
    this.cam.y = e.y
  }

  fitCompany(): void {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const e of this.entities.values()) {
      minX = Math.min(minX, e.x - e.w)
      maxX = Math.max(maxX, e.x + e.w)
      minY = Math.min(minY, e.y - e.h)
      maxY = Math.max(maxY, e.y + e.h)
    }
    this.cam.x = (minX + maxX) / 2
    this.cam.y = (minY + maxY) / 2
    const zx = this.width / (maxX - minX + 120)
    const zy = this.height / (maxY - minY + 120)
    this.cam.zoom = clampZoom(Math.min(zx, zy))
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.remove()
  }

  // ─────────────────────── input handlers ──

  private pick(sx: number, sy: number): string | null {
    const [wx, wy] = screenToWorld(this.cam, sx, sy, this.width, this.height)
    for (const e of [...this.entities.values()].reverse()) {
      const half = Math.max(e.w, e.h) / 2
      if (Math.hypot(wx - e.x, wy - e.y) <= half) return e.id
    }
    return null
  }

  private onPointerMove = (ev: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ev.clientX - rect.left
    this.pointer.y = ev.clientY - rect.top

    if (this.pointer.down) {
      // pan（spec §18）
      const dx = (ev.clientX - this.pointer.lastX) / this.cam.zoom
      const dy = (ev.clientY - this.pointer.lastY) / this.cam.zoom
      this.cam.x -= dx
      this.cam.y -= dy
      this.pointer.moved = true
    }
    this.pointer.lastX = ev.clientX
    this.pointer.lastY = ev.clientY

    const hit = this.pick(this.pointer.x, this.pointer.y)
    if ((hit ?? null) !== (this.hoveredId ?? null)) {
      this.hoveredId = hit
      // 回傳節點附近的螢幕座標，讓 tooltip 跟著節點走
      if (hit) {
        const e = this.entities.get(hit)!
        const [nx, ny] = this.w2s(e.x, e.y)
        this.callbacks.onHover(hit, nx + (e.w / 2) * this.cam.zoom, ny)
      } else {
        this.callbacks.onHover(null, 0, 0)
      }
    } else if (hit && this.pointer.down) {
      // pan 時 tooltip 跟著節點更新
      const e = this.entities.get(hit)!
      const [nx, ny] = this.w2s(e.x, e.y)
      this.callbacks.onHover(hit, nx + (e.w / 2) * this.cam.zoom, ny)
    }
    document.body.style.cursor = hit ? 'pointer' : ''
  }

  private onPointerDown = (ev: PointerEvent): void => {
    this.pointer.down = true
    this.pointer.moved = false
    this.pointer.lastX = ev.clientX
    this.pointer.lastY = ev.clientY
  }

  private onPointerUp = (): void => {
    if (this.pointer.down && !this.pointer.moved) {
      const hit = this.pick(this.pointer.x, this.pointer.y)
      if (hit) this.callbacks.onClick(hit)
    }
    this.pointer.down = false
  }

  private onPointerLeave = (): void => {
    if (this.hoveredId) {
      this.hoveredId = null
      this.callbacks.onHover(null, 0, 0)
    }
  }

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault()
    const factor = Math.exp(-ev.deltaY * 0.0012)
    const before = this.cam.zoom
    this.cam.zoom = clampZoom(before * factor)
    // 以滑鼠位置為縮放中心
    const rect = this.canvas.getBoundingClientRect()
    const sx = ev.clientX - rect.left
    const sy = ev.clientY - rect.top
    const [wx, wy] = screenToWorld({ ...this.cam, zoom: before }, sx, sy, this.width, this.height)
    this.cam.x = wx - (sx - this.width / 2) / this.cam.zoom
    this.cam.y = wy - (sy - this.height / 2) / this.cam.zoom
  }

  // ─────────────────────────── resize ──

  private resize(): void {
    const w = this.container.clientWidth || 800
    const h = this.container.clientHeight || 600
    if (w === 0 || h === 0) return
    this.width = w
    this.height = h
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) // spec §27
    this.canvas.width = w * this.dpr
    this.canvas.height = h * this.dpr
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
  }

  // ─────────────────────────── loop ──

  private animate = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const now = performance.now()
    if (this.lastFrameTime === 0) this.lastFrameTime = now
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05)
    this.lastFrameTime = now
    this.update(dt, now / 1000)
    this.render(now / 1000, dt)
  }

  // ─────────────────────────── update ──

  private update(dt: number, t: number): void {
    // 背景粒子緩慢漂移
    if (!this.reducedMotion) {
      for (const b of this.bgParticles) {
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (Math.abs(b.x) > 1150) b.vx *= -1
        if (Math.abs(b.y) > 780) b.vy *= -1
      }
    }
    // 資料粒子前進；熱粒子到終點後熄滅回池
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i]!.age += dt
      if (this.pulses[i]!.age > 0.9) this.pulses.splice(i, 1)
    }
    void t
  }

  // ─────────────────────────── render ──

  private render(t: number, dt: number): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, this.width, this.height)

    // 背景：中央極細 radial glow（深度感 spec §34）
    const [ccx, ccy] = this.w2s(0, -60)
    const rg = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, this.height * 0.9)
    rg.addColorStop(0, 'rgba(38,64,120,0.13)')
    rg.addColorStop(1, 'rgba(38,64,120,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, this.width, this.height)

    // 背景粒子（世界座標 → 有視差深度）
    ctx.save()
    for (const b of this.bgParticles) {
      const [sx, sy] = this.w2s(b.x, b.y)
      ctx.globalAlpha = b.alpha
      ctx.fillStyle = '#8fb4ff'
      ctx.beginPath()
      ctx.arc(sx, sy, b.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // 相關性判定（hover spotlight：只亮相關節點 spec §19）
    const related = new Set<string>()
    if (this.hoveredId) {
      related.add(this.hoveredId)
      for (const c of this.connections) {
        if (c.a === this.hoveredId) related.add(c.b)
        if (c.b === this.hoveredId) related.add(c.a)
      }
    }
    const dimming = this.spotlightId ?? (this.hoveredId ? '__hover__' : null)

    // ── 連線：兩態 ──
    // 進行中（一端 working）→ 青色描邊 + 粒子沿工作方向流動
    // 其餘 → 細藍底線
    this.connections.forEach((c, ci) => {
      const ea = this.entities.get(c.a)!
      const eb = this.entities.get(c.b)!
      const stA = this.statuses.get(ea.statusKey) ?? 'idle'
      const stB = this.statuses.get(eb.statusKey) ?? 'idle'
      // 工作方向：working 端 → 另一端
      const aWorking = STATUS_VISUAL[stA].motion === 'flow'
      const bWorking = STATUS_VISUAL[stB].motion === 'flow'
      const forward = bWorking ? false : true // true: a→b, false: b→a
      const active = aWorking || bWorking

      const inRelated =
        !related.size ||
        related.has(c.a) ||
        related.has(c.b)
      const alpha = dimming && !inRelated ? 0.55 : 1

      // 幾何：曲線起訖點依工作方向排列（粒子流向＝工作流向）
      const [ax, ay] = this.w2s(ea.x, ea.y)
      const [bx, by] = this.w2s(eb.x, eb.y)
      const cxw = (ea.x + eb.x) / 2 + c.bowX
      const cyw = (ea.y + eb.y) / 2 + c.bowY
      const [cx, cy] = this.w2s(cxw, cyw)

      // 底線：細藍
      ctx.save()
      ctx.globalAlpha = alpha * 0.75
      ctx.strokeStyle = C.netLine
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(cx, cy, bx, by)
      ctx.stroke()
      ctx.restore()

      if (!active) return

      // 進行中：青色呼吸描邊
      ctx.save()
      ctx.globalAlpha = alpha * (0.3 + 0.1 * Math.sin(t * 3 + ci))
      ctx.strokeStyle = C.cyan
      ctx.lineWidth = 1.8
      ctx.shadowColor = C.cyan
      ctx.shadowBlur = 7
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(cx, cy, bx, by)
      ctx.stroke()
      ctx.restore()

      // 資料粒子：只在「進行中」的線上流動，方向＝工作方向
      if (!active || this.reducedMotion) return
      const p0x = forward ? ax : bx
      const p0y = forward ? ay : by
      const p1x = forward ? bx : ax
      const p1y = forward ? by : ay
      for (const p of this.particles) {
        if (p.connIdx !== ci) continue
        p.t += p.speed * 0.016
        if (p.t > 1) {
          // 常駐粒子循環；熱粒子（事件注入）跑一次就熄滅
          if (p.hot) {
            p.t = 2
            p.hot = false
            continue
          }
          p.t = 0
        }
        const u = 1 - p.t
        const px_ = u * u * p0x + 2 * u * p.t * cx + p.t * p.t * p1x
        const py_ = u * u * p0y + 2 * u * p.t * cy + p.t * p.t * p1y
        // trail（淡出殘影）
        for (let k = 1; k <= 3; k++) {
          const tt = Math.max(0, p.t - k * 0.02)
          const uu = 1 - tt
          const tx_ = uu * uu * p0x + 2 * uu * tt * cx + tt * tt * p1x
          const ty_ = uu * uu * p0y + 2 * uu * tt * cy + tt * tt * p1y
          drawGlowCircle(ctx, tx_, ty_, p.size * (1 - k * 0.22), C.flow, 4, 0.25 * (1 - k / 4))
        }
        drawGlowCircle(ctx, px_, py_, p.size, p.hot ? C.flowHot : C.flow, 10)
      }
    })

    // ── 節點 ──
    const drawOrder = [...this.entities.values()]
    for (const e of drawOrder) {
      const isHovered = this.hoveredId === e.id
      const isFocused = this.focusedId === e.id
      const isSpot = this.spotlightId === e.statusKey && this.spotlightId !== null
      const highlighted = isHovered || isFocused || isSpot
      const dimmed =
        dimming !== null &&
        !highlighted &&
        (dimming === '__hover__'
          ? !related.has(e.id)
          : e.statusKey !== this.spotlightId)
      const alpha = dimmed ? 0.55 : 1

      this.drawAgentNode(e, t, dt, alpha, highlighted)
    }

    // ── 事件脈衝環 ──
    for (const p of this.pulses) {
      const e = this.entities.get(p.entityId)
      if (!e) continue
      const k = p.age / 0.9
      const [x, y] = this.w2s(e.x, e.y)
      ctx.save()
      ctx.globalAlpha = 0.7 * (1 - k)
      ctx.strokeStyle = p.color
      ctx.lineWidth = 2 * (1 - k) + 0.5
      ctx.shadowColor = p.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(x, y, Math.max(e.w, e.h) * (0.6 + k), 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // ────────────────────── node drawers ──

  private drawAgentNode(
    e: Entity,
    t: number,
    dt: number,
    alpha: number,
    highlighted: boolean,
  ): void {
    const ctx = this.ctx
    const status = this.statuses.get(e.statusKey) ?? 'idle'
    const vis = STATUS_VISUAL[status]

    // ── 狀態色平滑插值（切換不瞬跳）──
    const [tr, tg, tb] = hexToRgb(vis.color)
    const k = Math.min(dt * (vis.motion === 'error' ? 8 : 3), 1) // error 快速轉紅、一般柔和過渡
    e.cr += (tr - e.cr) * k
    e.cg += (tg - e.cg) * k
    e.cb += (tb - e.cb) * k
    const toHex = (v: number) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0')
    const color = `#${toHex(e.cr)}${toHex(e.cg)}${toHex(e.cb)}`
    // 邊框用目標色（比插值色鮮明一點），本體光暈用插值色
    const borderColor =
      highlighted ? C.cyan : `#${vis.color.toString(16).padStart(6, '0')}`

    const [x, y] = this.w2s(e.x, e.y)
    const zoom = this.cam.zoom

    ctx.save()
    ctx.globalAlpha = alpha

    // pulse 強度連續變數：依 motion 目標平滑趨近（非離散 switch）
    // pulsePhase ∈ [0,1]，0=靜止、1=全幅脈衝；error 用高頻方波柔化
    const targetPulseSpeed =
      vis.motion === 'flow' ? 7 : vis.motion === 'pulse' ? 4 : vis.motion === 'burst' ? 2.4 : vis.motion === 'error' ? 10 : 1.2
    const targetPulseAmp =
      vis.motion === 'static' ? 0.12 : vis.motion === 'dim' ? 0.18 : 0.45
    ;(e as Entity & { ps?: number; pa?: number }).ps ??= targetPulseSpeed
    ;(e as Entity & { ps?: number; pa?: number }).pa ??= targetPulseAmp
    const ent = e as Entity & { ps: number; pa: number }
    ent.ps += (targetPulseSpeed - ent.ps) * Math.min(dt * 2.5, 1)
    ent.pa += (targetPulseAmp - ent.pa) * Math.min(dt * 2.5, 1)
    const wave = 0.5 + 0.5 * Math.sin(t * ent.ps)
    const glowBase = vis.motion === 'flow' || highlighted ? 16 : 6
    const glow = glowBase + wave * ent.pa * 14

    drawGlowRoundRect(
      ctx,
      { id: e.id, x, y, w: e.w * zoom, h: e.h * zoom },
      {
        borderColor,
        borderWidth: highlighted ? 1.8 : 1.2,
        glow,
        fill: C.cardFill,
        radius: 10 * zoom,
      },
    )

    // 內容：狀態燈 + 名稱 + 狀態文字
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${11 * zoom}px ui-monospace, SFMono-Regular, monospace`
    ctx.fillStyle = C.textBright
    ctx.fillText(e.label.toUpperCase(), x - e.w * zoom * 0.36, y - 8 * zoom)
    // 狀態指示：符號亮度連續呼吸（error 高頻閃爍也走 sin 波，無硬切）
    const blinkFreq = vis.motion === 'error' ? 10 : ent.ps
    const lampAlpha =
      vis.motion === 'error'
        ? 0.25 + 0.75 * Math.max(0, Math.sin(t * blinkFreq))
        : 0.35 + 0.65 * wave
    drawGlowCircle(ctx, x - e.w * zoom * 0.33, y + 10 * zoom, 3 * zoom, color, 6, lampAlpha)
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * (0.55 + 0.45 * wave)
    ctx.font = `600 ${10 * zoom}px "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif`
    ctx.fillText(statusLabel(status), x - e.w * zoom * 0.26, y + 10 * zoom)
    ctx.globalAlpha = alpha

    // thinking：周圍旋轉粒子（淡入淡出隨脈衝強度）
    const orbitStrength = vis.motion === 'pulse' ? ent.pa : 0
    if (orbitStrength > 0.02 && !this.reducedMotion) {
      for (let k2 = 0; k2 < 3; k2++) {
        const ang = t * 2.4 + (k2 * Math.PI * 2) / 3
        drawGlowCircle(
          ctx,
          x + Math.cos(ang) * e.w * zoom * 0.58,
          y + Math.sin(ang) * e.h * zoom * 0.72,
          2 * zoom,
          color,
          6,
          orbitStrength,
        )
      }
    }
    ctx.restore()
  }

  // ───────────────────────── helpers ──

  private isFlowActive(statusKey: string): boolean {
    const s = this.statuses.get(statusKey)
    if (!s) return false
    const m = STATUS_VISUAL[s].motion
    return m === 'flow' || s === 'completed'
  }

  private w2s(wx: number, wy: number): [number, number] {
    return worldToScreen(this.cam, wx, wy, this.width, this.height)
  }
}

function statusLabel(s: LandingAgentStatus): string {
  // 與 LANDING_STATUS_LABEL（types/landing.ts）同一套用語，繁體中文
  switch (s) {
    case 'working':
      return '工作中'
    case 'thinking':
      return '思考中'
    case 'waiting':
      return '等待中'
    case 'blocked':
      return '已阻塞'
    case 'completed':
      return '已完成'
    case 'error':
      return '錯誤'
    default:
      return '閒置'
  }
}

/** 狀態色 → [r,g,b] 0..1 */
function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

void CAMERA_LIMITS
