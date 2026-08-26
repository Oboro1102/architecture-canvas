import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ORG_CHART, ORG_EDGES, STATUS_VISUAL } from '@/types/landing'
import type { LandingAgentStatus } from '@/types/landing'

/**
 * V3 ThreeUI — AI Company Digital Twin 場景（dark / low-poly / data-driven）。
 *
 * 視覺語言：Futuristic Digital City —— 深色環境、低模建築群、
 * 橘白青三色 emissive、CatmullRom 工作流路徑上流動的資料粒子。
 * 每個視覺元素對應產品概念：建築 = Agent、路徑 = Workflow、
 * 粒子 = Data/Task、中央核心 = AI Company OS。
 *
 * 對外 API 維持不變（setStatuses / setHovered / setSpotlight / pulseAt /
 * setFocused / dispose），場景不含任何 Pinia / 業務邏輯；
 * Mock 與 Real workflow 都透過 store → setStatuses/setSpotlight 驅動，
 * 未來換成 WorkflowEvent 事件流只需在 wrapper 層轉接，場景不必重寫。
 */

/** Org x/tier → 城市平面座標。 */
function cityPos(x: number, tier: number): THREE.Vector3 {
  return new THREE.Vector3(x * 5.6, 0, (tier - 1.5) * 4.6)
}

const COL = {
  bg: 0x04060d,
  ground: 0x0a0e1a,
  grid: 0x18223a,
  body: 0x141b2e,
  trim: 0x2a3a5c,
  cyan: 0x22d3ee,
  amber: 0xf59e0b,
  white: 0xe8f0ff,
}

interface AgentEntity {
  id: string
  group: THREE.Group
  hitbox: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  bodyMat: THREE.MeshStandardMaterial
  /** 浮動 Agent 核心：發光八面體 */
  core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>
  coreRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  labelSprite: THREE.Sprite
  basePos: THREE.Vector3
  /** 建築上的 emissive 窗帶 */
  strips: THREE.Mesh[]
}

interface FlowPath {
  a: string
  b: string
  curve: THREE.CatmullRomCurve3
  line: THREE.Line
  glowLine: THREE.Line
}

export interface SceneCallbacks {
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}

// ────────────────────────── 共用幾何／材質 ──────────────────────────

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 24px ui-monospace, SFMono-Regular, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(4,6,13,0.6)'
  const w = ctx.measureText(text.toUpperCase()).width + 26
  ctx.beginPath()
  ctx.roundRect(128 - w / 2, 10, w, 44, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(42,58,92,0.9)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(200,220,255,0.95)'
  ctx.fillText(text.toUpperCase(), 128, 33)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
}

// ───────────────────────────── 場景本體 ─────────────────────────────

export class CompanyScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private entities = new Map<string, AgentEntity>()
  private paths: FlowPath[] = []
  /** 資料粒子：一組 Points，位置由 path curves 驅動 */
  private flowPoints!: THREE.Points
  private coreGroup!: THREE.Group
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(-10, -10)
  private lastFrameTime = 0
  private raf = 0
  private ro: ResizeObserver
  private reducedMotion: boolean
  private disposed = false

  private statuses = new Map<string, LandingAgentStatus>()
  private hoveredId: string | null = null
  private focusedId: string | null = null
  private spotlightId: string | null = null
  private pulses: Array<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>> = []

  constructor(
    private container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.reducedMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height)
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.setAttribute('aria-hidden', 'true')

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COL.bg)
    this.scene.fog = new THREE.FogExp2(COL.bg, 0.022)

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 160)
    this.camera.position.set(11, 12, 16)

    // 受限的 orbit 相機：可旋轉/縮放，不可轉到地下或拉太遠
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 1.2, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 8
    this.controls.maxDistance = 38
    this.controls.minPolarAngle = 0.25
    this.controls.maxPolarAngle = Math.PI * 0.42 // 不低於地平線
    this.controls.update()

    this.addLights()
    this.buildGround()
    this.buildCore()
    this.buildEntities()
    this.buildPaths()
    this.buildFlowParticles()

    this.ro = new ResizeObserver(() => this.onResize())
    this.ro.observe(container)
    window.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('click', this.onClick)
    this.animate()
  }

  // ───────────────────────────── build ──

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x33415e, 0x05070f, 0.85))
    const key = new THREE.DirectionalLight(0x9db8e8, 0.7)
    key.position.set(-8, 14, 6)
    this.scene.add(key)
    // 核心輝光：中央冷青點光，讓核心像真的在「供電」
    const coreLight = new THREE.PointLight(0x67e8f9, 26, 20)
    coreLight.position.set(0, 3, 0)
    this.scene.add(coreLight)
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 0.95 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    this.scene.add(ground)

    const grid = new THREE.GridHelper(56, 28, COL.grid, COL.grid)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.32
    this.scene.add(grid)

    // 核心周圍的同心資料環（裝飾但語義化＝orchestration 半徑）
    for (const r of [3.4, 5.2]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.02, 72),
        new THREE.MeshBasicMaterial({
          color: COL.cyan,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.01
      this.scene.add(ring)
    }
  }

  /** 中央 AI Company OS Core——抽象科技核心：球 + 內核 + 雙環。 */
  private buildCore(): void {
    const g = new THREE.Group()
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.75, 2),
      new THREE.MeshBasicMaterial({ color: 0xa5f3fc }),
    )
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshBasicMaterial({
        color: COL.cyan,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      }),
    )
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.03, 10, 64),
      new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0.55 }),
    )
    ringA.rotation.x = Math.PI / 2.4
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.02, 10, 64),
      new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.4 }),
    )
    ringB.rotation.x = Math.PI / 1.8
    g.add(inner, shell, ringA, ringB)
    g.position.set(0, 2.6, 0)
    // 核心支柱
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 2.6, 8),
      new THREE.MeshStandardMaterial({
        color: COL.trim,
        emissive: COL.cyan,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.6,
      }),
    )
    pillar.position.y = 1.3
    this.scene.add(pillar)
    this.coreGroup = g
    this.scene.add(g)
  }

  /** Agent 建築：低模塔樓 + 窗帶 + 屋頂天線 + 浮動 Agent 核心。 */
  private buildEntities(): void {
    ORG_CHART.forEach((n, i) => {
      const group = new THREE.Group()
      const pos = cityPos(n.x, n.tier)
      const seed = i * 53

      const isCeo = n.id === 'ceo'
      const towerH = isCeo ? 3.6 : 1.1 + ((seed >> 2) % 4) * 0.55
      const w = isCeo ? 1.5 : 0.9 + ((seed % 3) * 0.12)
      const d = isCeo ? 1.5 : 0.9 + (((seed >> 1) % 3) * 0.12)

      const bodyMat = new THREE.MeshStandardMaterial({
        color: COL.body,
        roughness: 0.55,
        metalness: 0.45,
      })
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, towerH, d), bodyMat)
      body.position.y = towerH / 2
      body.userData.agentId = n.id

      // 窗帶：水平 emissive 細條（共用材質 clone，強度逐棟驅動）
      const strips: THREE.Mesh[] = []
      const stripRows = Math.max(2, Math.floor(towerH / 0.5))
      const stripGeo = new THREE.PlaneGeometry(w * 0.82, 0.06)
      for (let r = 0; r < stripRows; r++) {
        const mat = new THREE.MeshBasicMaterial({
          color: COL.cyan,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const front = new THREE.Mesh(stripGeo, mat)
        front.position.set(0, 0.4 + r * 0.5, d / 2 + 0.005)
        const back = front.clone()
        back.position.z = -d / 2 - 0.005
        back.rotation.y = Math.PI
        group.add(front, back)
        strips.push(front, back)
      }

      // 天線 / 頂部結構變化
      if (i % 2 === 0 || isCeo) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5),
          new THREE.MeshStandardMaterial({ color: COL.trim, metalness: 0.6, roughness: 0.5 }),
        )
        mast.position.y = towerH + 0.35
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshBasicMaterial({ color: COL.amber }),
        )
        tip.position.y = towerH + 0.74
        group.add(mast, tip)
      } else {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.55, 0.18, d * 0.55),
          new THREE.MeshStandardMaterial({
            color: COL.trim,
            emissive: COL.white,
            emissiveIntensity: 0.15,
            metalness: 0.5,
            roughness: 0.5,
          }),
        )
        cap.position.y = towerH + 0.09
        group.add(cap)
      }

      // 浮動 Agent 核心：發光八面體 + 環（狀態載體）
      const coreY = towerH + 1.05
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        new THREE.MeshBasicMaterial({ color: STATUS_VISUAL.idle.color }),
      )
      core.position.y = coreY
      const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.015, 8, 40),
        new THREE.MeshBasicMaterial({
          color: STATUS_VISUAL.idle.color,
          transparent: true,
          opacity: 0.5,
        }),
      )
      coreRing.rotation.x = Math.PI / 2
      coreRing.position.y = coreY
      group.add(core, coreRing)

      // 地面光環（spotlight / 交接效果）
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(w, d) * 0.8, Math.max(w, d) * 0.8 + 0.07, 48),
        new THREE.MeshBasicMaterial({
          color: STATUS_VISUAL.idle.color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.y = 0.04

      const label = makeTextSprite(n.role)
      label.position.y = coreY + 0.62

      group.add(body, halo, label)
      group.position.copy(pos)
      this.scene.add(group)
      this.entities.set(n.id, {
        id: n.id,
        group,
        hitbox: body as AgentEntity['hitbox'],
        bodyMat,
        core,
        coreRing,
        halo,
        labelSprite: label,
        basePos: pos.clone(),
        strips,
      })
    })
  }

  /** Workflow Paths：CatmullRom 曲線，微弱 emissive；活躍時亮起。 */
  private buildPaths(): void {
    for (const [a, b] of ORG_EDGES) {
      const ea = this.entities.get(a)
      const eb = this.entities.get(b)
      if (!ea || !eb) continue
      const pa = ea.basePos.clone().setY(0.06)
      const pb = eb.basePos.clone().setY(0.06)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      mid.y += pa.distanceTo(pb) * 0.12 + 0.25
      const side = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3(0, 1, 0)).normalize()
      mid.addScaledVector(side, 0.35)
      const curve = new THREE.CatmullRomCurve3([pa, mid, pb])

      const pts = curve.getPoints(40)
      const base = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.8 }),
      )
      const glow = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: COL.cyan,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      this.scene.add(base, glow)
      this.paths.push({ a, b, curve, line: base, glowLine: glow })
    }
  }

  /** Data Flow 粒子：單一 Points 物件承載所有路徑的流動粒子（省 draw call）。 */
  private buildFlowParticles(): void {
    const count = this.paths.length * 3
    const arr = new Float32Array(count * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    this.flowPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x67e8f9,
        size: 0.14,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
    this.flowPoints.visible = false
    this.scene.add(this.flowPoints)
  }

  // ─────────────────────────── public API ──

  /** Push current statuses; scene reflects them next frame (spec §11). */
  setStatuses(map: Record<string, LandingAgentStatus>): void {
    this.statuses.clear()
    for (const [k, v] of Object.entries(map)) this.statuses.set(k, v)
  }

  setHovered(id: string | null): void {
    this.hoveredId = id
  }

  /**
   * Spotlight — 目前執行步驟的 Agent 高亮，其餘壓暗。
   * 亮度差異 + 核心脈衝節奏 + 文字標籤，非僅靠顏色（spec §11）。
   */
  setSpotlight(id: string | null): void {
    this.spotlightId = id
  }

  /** 步驟完成 / 交接時從節點放出擴散光環（= Event pulse）。 */
  pulseAt(id: string): void {
    const e = this.entities.get(id)
    if (!e || this.reducedMotion) return
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 48),
      new THREE.MeshBasicMaterial({
        color: STATUS_VISUAL[this.statuses.get(id) ?? 'idle'].color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(e.basePos.x, 0.05, e.basePos.z)
    ring.userData.pulse = { life: 0 }
    this.scene.add(ring)
    this.pulses.push(ring as typeof this.pulses[number])
  }

  /** 點擊 Agent 時鏡頭平順推進到該節點（Vue 端仍負責面板）。 */
  setFocused(id: string | null): void {
    this.focusedId = id
    if (id) {
      const e = this.entities.get(id)
      if (e) {
        // 用 controls target 平移實現聚焦（保留使用者可繼續 orbit）
        const goal = e.basePos.clone().setY(1.4)
        this.controls.target.copy(goal)
        const dir = this.camera.position.clone().sub(this.controls.target).normalize()
        this.camera.position.copy(goal.clone().addScaledVector(dir, Math.min(this.camera.position.distanceTo(goal), 14)))
      }
    } else {
      this.controls.target.set(0, 1.2, 0)
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.ro.disconnect()
    window.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('click', this.onClick)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        o.geometry.dispose()
        const m = o.material as THREE.Material & { map?: THREE.Texture }
        m?.dispose()
        m?.map?.dispose()
      }
      if (o instanceof THREE.Sprite) {
        o.material.map?.dispose()
        o.material.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ─────────────────────────── internal ──

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  private onClick = (): void => {
    const hit = this.pick()
    if (hit) this.callbacks.onClick(hit)
  }

  private pick(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = [...this.entities.values()].map((e) => e.hitbox)
    const hits = this.raycaster.intersectObjects(meshes, false)
    return hits.length > 0 ? (hits[0]!.object.userData.agentId as string) : null
  }

  private onResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private animate = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    const now = performance.now()
    if (this.lastFrameTime === 0) this.lastFrameTime = now
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05)
    this.lastFrameTime = now
    const t = now / 1000

    if (!this.reducedMotion) this.controls.update()

    // ── 核心：呼吸 pulse + 環旋轉 ──
    if (!this.reducedMotion) {
      const s = 1 + Math.sin(t * 1.3) * 0.06
      this.coreGroup.children[0]!.scale.setScalar(s)
      this.coreGroup.rotation.y += dt * 0.3
      const ra = this.coreGroup.children[2]!
      const rb = this.coreGroup.children[3]!
      ra.rotation.z += dt * 0.5
      rb.rotation.z -= dt * 0.35
    }

    // ── Agent 狀態 ──
    for (const [id, e] of this.entities) {
      const status = this.statuses.get(id) ?? 'idle'
      const vis = STATUS_VISUAL[status]
      const highlighted =
        this.hoveredId === id || this.focusedId === id || this.spotlightId === id
      const dimmed =
        this.spotlightId !== null && id !== this.spotlightId && !this.reducedMotion
      const dimF = dimmed ? 0.18 : 1

      // 核心：色彩 + 脈衝節奏（idle 慢速低亮、working 快閃高亮）
      e.core.material.color.setHex(vis.color)
      e.coreRing.material.color.setHex(vis.color)
      let coreScale = 1
      switch (vis.motion) {
        case 'pulse': // thinking — 中速呼吸
          coreScale = 1 + Math.sin(t * 4) * 0.18
          break
        case 'flow': // working — 快速脈衝
          coreScale = 1.15 + Math.abs(Math.sin(t * 7)) * 0.25
          break
        case 'burst': // completed — 短暫放大後回穩
          coreScale = 1 + Math.max(0, Math.sin(t * 2)) * 0.3
          break
        case 'error': // error — 急促抖動
          coreScale = Math.sin(t * 10) > 0 ? 1.25 : 0.9
          break
        default:
          coreScale = 1 + Math.sin(t * 1.2) * 0.07 // idle — 緩慢低幅 pulse
      }
      if (!this.reducedMotion) e.core.scale.setScalar(coreScale)
      e.core.material.opacity = dimmed ? 0.25 : 1
      e.core.material.transparent = dimmed
      e.coreRing.rotation.z += dt * (highlighted && !dimmed ? 3 : vis.motion === 'flow' ? 2 : 0.4)
      e.coreRing.material.opacity = (vis.motion === 'dim' ? 0.2 : 0.5) * dimF

      // 浮動上下（Agent 是活的）
      if (!this.reducedMotion) {
        const baseY = (e.core.userData.baseY ??= e.core.position.y) as number
        const bob = Math.sin(t * 1.6 + id.charCodeAt(0)) * 0.05
        e.core.position.setY(baseY + bob)
        e.coreRing.position.y = e.core.position.y
      }

      // 窗帶：working/hovered 亮起
      let stripTarget = 0
      if (!dimmed) {
        if (vis.motion === 'flow') stripTarget = 0.55 + 0.2 * Math.sin(t * 3)
        else if (highlighted) stripTarget = 0.35
        else stripTarget = status === 'error' ? 0.4 : 0.12
      }
      for (const s of e.strips) {
        ;(s.material as THREE.MeshBasicMaterial).opacity +=
          (stripTarget - (s.material as THREE.MeshBasicMaterial).opacity) *
          Math.min(dt * 5, 1)
      }

      // 地面光環
      if (highlighted && !dimmed) {
        e.halo.material.opacity = 0.7
        e.halo.material.color.setHex(vis.color)
        if (!this.reducedMotion) e.halo.rotation.z += dt * 2
      } else {
        e.halo.material.opacity *= 1 - Math.min(dt * 5, 1)
      }
      e.labelSprite.material.opacity = dimmed ? 0.2 : 1
    }

    // ── Workflow path 亮起判定 + 資料粒子沿曲線移動 ──
    const attr = this.flowPoints.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    let anyActive = false
    this.paths.forEach((p, i) => {
      const sa = this.statuses.get(p.a) ?? 'idle'
      const sb = this.statuses.get(p.b) ?? 'idle'
      const active =
        STATUS_VISUAL[sa].motion === 'flow' ||
        STATUS_VISUAL[sb].motion === 'flow' ||
        sa === 'completed' ||
        sb === 'completed'
      const glowMat = p.glowLine.material as THREE.LineBasicMaterial
      glowMat.opacity += ((active ? 0.65 : 0) - glowMat.opacity) * Math.min(dt * 6, 1)
      glowMat.color.setHex(sb === 'completed' ? 0x34d399 : COL.cyan)

      for (let k = 0; k < 3; k++) {
        const idx = i * 3 + k
        if (active && !this.reducedMotion) {
          anyActive = true
          const phase = (t * 0.3 + k / 3 + i * 0.13) % 1
          const pos = p.curve.getPoint(phase)
          arr[idx * 3] = pos.x
          arr[idx * 3 + 1] = pos.y
          arr[idx * 3 + 2] = pos.z
        } else {
          arr[idx * 3 + 1] = 9999
        }
      }
    })
    attr.needsUpdate = true
    this.flowPoints.visible = anyActive

    // ── 脈衝光環擴散（Event effect）──
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]!
      const life = (p.userData.pulse as { life: number }).life
      const k = life / 0.9
      p.scale.setScalar(1 + k * 4)
      p.material.opacity = 0.9 * (1 - k)
      ;(p.userData.pulse as { life: number }).life += dt
      if (k >= 1) {
        this.scene.remove(p)
        p.geometry.dispose()
        p.material.dispose()
        this.pulses.splice(i, 1)
      }
    }

    this.renderer.render(this.scene, this.camera)
  }
}
