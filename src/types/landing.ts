/**
 * V3 — Landing / ThreeUI domain types (spec §10–12, §33).
 *
 * V3 repositions the product as a 3D landing experience. The existing
 * `types/agent.ts` Agent stays the runtime source of truth; these types are
 * the presentation-layer view of it for the 3D scene and landing sections.
 */
import type { AgentStatus, AgentRole } from './agent'

/** Spec §11 — full status set required by the 3D scene. */
export type LandingAgentStatus =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'waiting'
  | 'completed'
  | 'error'
  | 'blocked'

/** Map runtime statuses onto the landing status set. */
export function toLandingStatus(status: AgentStatus): LandingAgentStatus {
  switch (status) {
    case 'working':
      return 'working'
    case 'waiting':
      return 'waiting'
    case 'blocked':
      return 'blocked'
    case 'reviewing':
      return 'thinking'
    case 'completed':
      return 'completed'
    default:
      return 'idle'
  }
}

export const LANDING_STATUS_LABEL: Record<LandingAgentStatus, string> = {
  idle: '● 閒置',
  thinking: '● 思考中',
  working: '● 工作中',
  waiting: '● 等待中',
  completed: '● 已完成',
  error: '● 錯誤',
  blocked: '● 已阻塞',
}

/** Visual + motion behaviour per status — the scene must not rely on color alone. */
export const STATUS_VISUAL: Record<
  LandingAgentStatus,
  { color: number; motion: 'static' | 'pulse' | 'flow' | 'dim' | 'burst' | 'error'; emissiveBoost: number }
> = {
  // 色彩語言與 UI 狀態燈統一（spec §11）：綠＝執行中、黃＝等待、紅＝錯誤
  idle: { color: 0x8b8fa3, motion: 'static', emissiveBoost: 0.15 },
  thinking: { color: 0xa78bfa, motion: 'pulse', emissiveBoost: 0.6 },
  working: { color: 0x34d399, motion: 'flow', emissiveBoost: 0.8 },
  waiting: { color: 0xf59e0b, motion: 'dim', emissiveBoost: 0.1 },
  completed: { color: 0xa7f3d0, motion: 'burst', emissiveBoost: 0.5 },
  error: { color: 0xef4444, motion: 'error', emissiveBoost: 0.9 },
  blocked: { color: 0xfb923c, motion: 'dim', emissiveBoost: 0.2 },
}

/** A node in the org chart rendered by the 3D scene. */
export interface OrgNode {
  id: string
  role: AgentRole
  /** Normalized layout position (-1..1 x, y) in the company plane. */
  x: number
  y: number
  tier: number
  parentId?: string
}

/**
 * Spec §2/§9 — CEO on top, three departments, QA, RESULT.
 * Layout shared by the 3D scene AND the mobile vertical flow.
 */
export const ORG_CHART: OrgNode[] = [
  { id: 'ceo', role: 'ceo', x: 0, y: 1, tier: 0 },
  { id: 'product', role: 'product', x: -0.85, y: 0.25, tier: 1, parentId: 'ceo' },
  { id: 'designer', role: 'designer', x: 0, y: 0.25, tier: 1, parentId: 'ceo' },
  { id: 'cto', role: 'cto', x: 0.85, y: 0.25, tier: 1, parentId: 'ceo' },
  { id: 'frontend', role: 'frontend', x: -0.5, y: -0.55, tier: 2, parentId: 'cto' },
  { id: 'backend', role: 'backend', x: 0.5, y: -0.55, tier: 2, parentId: 'cto' },
  { id: 'qa', role: 'qa', x: -0.35, y: -1.3, tier: 3, parentId: 'frontend' },
]

/** Workflow execution order for simulation highlight (spec §41). */
export const EXECUTION_ORDER = [
  'ceo',
  'product',
  'designer',
  'frontend',
  'backend',
  'qa',
] as const

/** Edges drawn between nodes (org parents + cross-links). */
export const ORG_EDGES: Array<[string, string]> = (() => {
  const edges: Array<[string, string]> = []
  for (const n of ORG_CHART) if (n.parentId) edges.push([n.parentId, n.id])
  // QA also reviews designer/backend output; result flows to core
  edges.push(['backend', 'qa'])
  edges.push(['designer', 'qa'])
  return edges
})()

export interface WorkflowEdgeVM {
  from: string
  to: string
}
