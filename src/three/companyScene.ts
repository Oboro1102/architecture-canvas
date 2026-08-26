import * as THREE from 'three'
import {
  ORG_CHART,
  ORG_EDGES,
  STATUS_VISUAL,
} from '@/types/landing'
import type { LandingAgentStatus } from '@/types/landing'

/**
 * V3 ThreeUI — AI Company 3D scene (spec §33–34, §36).
 *
 * Every visual element maps to a product concept: core = company brain,
 * nodes = roles, edges = information flow, particles = task/data flow,
 * camera transition = entering an agent workspace.
 *
 * The scene is deliberately framework-free: the Vue wrapper feeds it status
 * snapshots and receives hover/click events. It owns no Pinia state.
 */

const WORLD_SCALE = 4

interface NodeObject {
  id: string
  group: THREE.Group
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  basePos: THREE.Vector3
  labelSprite: THREE.Sprite
}

export interface SceneCallbacks {
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 28px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(226,232,240,0.95)'
  ctx.fillText(text.toUpperCase(), 128, 32)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.6, 0.4, 1)
  return sprite
}

/** Map org x/y (-1..1) into world coordinates with depth per tier. */
function nodeWorldPos(x: number, y: number, tier: number): THREE.Vector3 {
  return new THREE.Vector3(x * WORLD_SCALE, y * WORLD_SCALE * 0.72, -tier * 1.2 + 1.2)
}

export class CompanyScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private nodes = new Map<string, NodeObject>()
  private edgeLines!: THREE.LineSegments
  private coreGroup!: THREE.Group
  private particles!: THREE.Points
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(-10, -10)
  private lastFrameTime = 0
  private raf = 0
  private ro: ResizeObserver
  private reducedMotion: boolean
  private disposed = false
  /** Camera target lerp state */
  private camTarget = new THREE.Vector3(0, 0, 11.5)
  private lookTarget = new THREE.Vector3(0, 0, 0)
  private camGoal = this.camTarget.clone()
  private lookGoal = this.lookTarget.clone()
  private statuses = new Map<string, LandingAgentStatus>()
  private hoveredId: string | null = null
  private focusedId: string | null = null
  private spotlightId: string | null = null
  private pulses: Array<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>> = []
  private particleBase: Float32Array

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
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height)
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.setAttribute('aria-hidden', 'true')

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x05060f, 0.028)

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    this.camera.position.copy(this.camTarget)

    this.addLights()
    this.buildCore()
    this.buildNodes()
    this.buildEdges()
    if (!this.reducedMotion) this.buildParticles()

    // gentle ambient dust — very few points, cheap
    const dustCount = 120
    const dustGeo = new THREE.BufferGeometry()
    const dustArr = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustArr[i * 3] = (Math.random() - 0.5) * 24
      dustArr[i * 3 + 1] = (Math.random() - 0.5) * 14
      dustArr[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustArr, 3))
    this.scene.add(
      new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: 0x64748b,
          size: 0.04,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      ),
    )

    this.particleBase = new Float32Array(0)
    if (this.particles) {
      this.particleBase = new Float32Array(
        this.particles.geometry.getAttribute('position').array as Float32Array,
      )
    }

    this.ro = new ResizeObserver(() => this.onResize())
    this.ro.observe(container)
    window.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('click', this.onClick)
    this.animate()
  }

  // ───────────────────────────── build ──

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.7))
    const key = new THREE.DirectionalLight(0xaaccff, 1.4)
    key.position.set(4, 6, 8)
    this.scene.add(key)
    const rim = new THREE.PointLight(0x6366f1, 30, 40)
    rim.position.set(-6, -2, 4)
    this.scene.add(rim)
  }

  private buildCore(): void {
    const g = new THREE.Group()
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 2),
      new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x6366f1,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.4,
      }),
    )
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.25, 1),
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      }),
    )
    g.add(inner, shell)
    g.position.set(0, WORLD_SCALE * 0.72, 1.2)
    this.coreGroup = g
    this.scene.add(g)
  }

  private buildNodes(): void {
    for (const n of ORG_CHART) {
      const group = new THREE.Group()
      const pos = nodeWorldPos(n.x, n.y, n.tier)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 32, 24),
        new THREE.MeshStandardMaterial({
          color: STATUS_VISUAL.idle.color,
          emissive: STATUS_VISUAL.idle.color,
          emissiveIntensity: STATUS_VISUAL.idle.emissiveBoost,
          roughness: 0.3,
          metalness: 0.3,
        }),
      )
      mesh.userData.agentId = n.id
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.62, 48),
        new THREE.MeshBasicMaterial({
          color: STATUS_VISUAL.idle.color,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        }),
      )
      halo.rotation.x = -Math.PI / 3
      const label = makeTextSprite(n.role)
      label.position.y = 0.85
      group.add(mesh, halo, label)
      group.position.copy(pos)
      this.scene.add(group)
      this.nodes.set(n.id, {
        id: n.id,
        group,
        mesh: mesh as NodeObject['mesh'],
        halo: halo as NodeObject['halo'],
        basePos: pos.clone(),
        labelSprite: label,
      })
    }
  }

  private buildEdges(): void {
    const pts: number[] = []
    for (const [a, b] of ORG_EDGES) {
      const na = ORG_CHART.find((n) => n.id === a)
      const nb = ORG_CHART.find((n) => n.id === b)
      if (!na || !nb) continue
      const pa = nodeWorldPos(na.x, na.y, na.tier)
      const pb = nodeWorldPos(nb.x, nb.y, nb.tier)
      // slight curve via midpoint lift
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      mid.z += 0.6
      pts.push(pa.x, pa.y, pa.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, pb.x, pb.y, pb.z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this.edgeLines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.45,
      }),
    )
    this.scene.add(this.edgeLines)
  }

  /** Task/data flow particles travelling along edges from working agents. */
  private buildParticles(): void {
    const count = ORG_EDGES.length * 2
    const arr = new Float32Array(count * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x67e8f9,
        size: 0.09,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.scene.add(this.particles)
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
   * 讓「現在是誰在做事」一眼可讀（非僅靠色彩：亮度差異 + 光環旋轉）。
   */
  setSpotlight(id: string | null): void {
    this.spotlightId = id
  }

  /** 步驟完成 / 交接時從節點放出擴散光環。 */
  pulseAt(id: string): void {
    const n = this.nodes.get(id)
    if (!n || this.reducedMotion) return
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.58, 48),
      new THREE.MeshBasicMaterial({
        color: STATUS_VISUAL[this.statuses.get(id) ?? 'idle'].color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 3
    ring.position.copy(n.basePos)
    ring.userData.pulse = { life: 0 }
    this.scene.add(ring)
    this.pulses.push(ring as typeof this.pulses[number])
  }

  setFocused(id: string | null): void {
    this.focusedId = id
    if (id) {
      const n = this.nodes.get(id)
      if (n) {
        this.camGoal.copy(n.basePos).add(new THREE.Vector3(1.6, 1.1, 4.2))
        this.lookGoal.copy(n.basePos)
      }
    } else {
      this.camGoal.set(0, 0, 11.5)
      this.lookGoal.set(0, 0, 0)
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    window.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('click', this.onClick)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose()
        const m = o.material as THREE.Material & { map?: THREE.Texture }
        m?.dispose()
        if (m?.map) m.map.dispose()
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
    const meshes = [...this.nodes.values()].map((n) => n.mesh)
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

    // camera smooth transition (spec §34 — smooth, reversible)
    this.camTarget.lerp(this.camGoal, 1 - Math.exp(-dt * 3))
    this.lookTarget.lerp(this.lookGoal, 1 - Math.exp(-dt * 3))
    // subtle mouse parallax on overview only
    let px = 0
    let py = 0
    if (!this.focusedId && !this.reducedMotion) {
      px = this.pointer.x * 0.7
      py = this.pointer.y * 0.4
    }
    this.camera.position.set(
      this.camTarget.x + px,
      this.camTarget.y + py,
      this.camTarget.z,
    )
    this.camera.lookAt(this.lookTarget)

    // core idle rotation + pulse
    if (!this.reducedMotion) {
      this.coreGroup.rotation.y += dt * 0.25
      const s = 1 + Math.sin(t * 1.4) * 0.03
      this.coreGroup.scale.setScalar(s)
    }

    // node states
    for (const [id, n] of this.nodes) {
      const status = this.statuses.get(id) ?? 'idle'
      const vis = STATUS_VISUAL[status]
      const mat = n.mesh.material
      // spotlight: non-active nodes dim down while a step is running
      const dimmed =
        this.spotlightId !== null && id !== this.spotlightId && !this.reducedMotion
      const dimFactor = dimmed ? 0.18 : 1
      const hoveredBoost =
        this.hoveredId === id || this.focusedId === id || this.spotlightId === id ? 1.28 : 1
      const s = n.mesh.scale.x + (hoveredBoost - n.mesh.scale.x) * Math.min(dt * 8, 1)
      n.mesh.scale.setScalar(s)
      mat.color.setHex(vis.color)
      mat.emissive.setHex(vis.color)

      switch (vis.motion) {
        case 'pulse':
          mat.emissiveIntensity = vis.emissiveBoost * (0.6 + 0.4 * Math.sin(t * 4)) * dimFactor
          break
        case 'flow': {
          mat.emissiveIntensity = vis.emissiveBoost
          if (!this.reducedMotion) {
            n.group.rotation.y += dt * 0.8
            n.halo.material.opacity =
              (0.5 + 0.25 * Math.sin(t * 6)) * dimFactor
          }
          break
        }
        case 'dim':
          mat.emissiveIntensity = vis.emissiveBoost
          n.labelSprite.material.opacity = 0.4 * dimFactor
          break
        case 'burst':
          mat.emissiveIntensity = vis.emissiveBoost * (0.5 + 0.5 * Math.max(0, Math.sin(t * 2))) * dimFactor
          break
        case 'error':
          mat.emissiveIntensity = vis.emissiveBoost * (Math.sin(t * 10) > 0 ? 1 : 0.2) * dimFactor
          break
        default:
          mat.emissiveIntensity = vis.emissiveBoost * dimFactor
          if (n.labelSprite.material.opacity < 1) n.labelSprite.material.opacity = 0.95 * dimFactor
      }
      // spotlight node gets an extra halo spin — motion cue beyond color
      if (this.spotlightId === id && !this.reducedMotion) {
        n.halo.rotation.z += dt * 3
        n.halo.material.opacity = 0.85
      }
      // transparent-ish look for dimmed labels
      if (dimmed) {
        n.labelSprite.material.opacity = 0.15
        n.halo.material.opacity = 0.08
      }
      // non-color signal: waiting/blocked halos stop rotating and shrink
      if (vis.motion === 'dim') n.halo.scale.setScalar(0.85)
      else n.halo.scale.setScalar(1)
    }

    // pulse rings — expand & fade out
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

    // particles flow along edges whose source or target is working/completed
    if (this.particles && !this.reducedMotion) {
      const attr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      let anyActive = false
      ORG_EDGES.forEach(([a, b], i) => {
        const sa = this.statuses.get(a) ?? 'idle'
        const sb = this.statuses.get(b) ?? 'idle'
        const active =
          STATUS_VISUAL[sa].motion === 'flow' ||
          STATUS_VISUAL[sb].motion === 'flow' ||
          sa === 'completed' ||
          sb === 'completed'
        const na = ORG_CHART.find((n) => n.id === a)!
        const nb = ORG_CHART.find((n) => n.id === b)!
        const pa = nodeWorldPos(na.x, na.y, na.tier)
        const pb = nodeWorldPos(nb.x, nb.y, nb.tier)
        for (let k = 0; k < 2; k++) {
          const idx = i * 2 + k
          const phase = (t * 0.35 + idx * 0.37) % 1
          if (active) {
            anyActive = true
            const p = pa.clone().lerp(pb, phase)
            arr[idx * 3] = p.x
            arr[idx * 3 + 1] = p.y
            arr[idx * 3 + 2] = p.z + 0.15
          } else {
            arr[idx * 3 + 1] = 9999 // hide offscreen
          }
        }
      })
      attr.needsUpdate = true
      this.particles.visible = anyActive
    }

    this.renderer.render(this.scene, this.camera)
  }
}
