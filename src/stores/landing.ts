import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ORG_CHART, toLandingStatus } from '@/types/landing'
import type { LandingAgentStatus } from '@/types/landing'
import { useAgentStore } from '@/stores/agents'
import { useCompanyStore } from '@/stores/company'

export type SectionKey =
  | 'hero'
  | 'company'
  | 'agents'
  | 'workflow'
  | 'simulation'
  | 'result'

/**
 * V3 landing UI state — which section is active, which agent the camera is
 * focused on. Runtime state stays in the existing stores; this store only
 * holds presentation concerns.
 */
export const useLandingStore = defineStore('landing', () => {
  const section = ref<SectionKey>('hero')
  /** Agent whose workspace is open (camera transition target). '' = overview. */
  const focusedAgentId = ref('')
  /** Hovered agent — drives tooltip + node emphasis in the scene. */
  const hoveredAgentId = ref('')

  const agents = useAgentStore()
  const company = useCompanyStore()

  function goto(s: SectionKey): void {
    section.value = s
    document.getElementById(`section-${s}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  function focusAgent(id: string): void {
    focusedAgentId.value = id
    section.value = 'agents'
  }

  function clearFocus(): void {
    focusedAgentId.value = ''
  }

  function hover(id: string): void {
    hoveredAgentId.value = id
  }

  /** Landing status for a node id ('qa' etc. map onto runtime agents). */
  function statusOf(id: string): LandingAgentStatus {
    const a = agents.agents.find((x) => x.id === id)
    if (!a) return 'idle'
    return toLandingStatus(a.status)
  }

  const anyRunning = computed(() => company.runState === 'running' || company.runState === 'paused')

  return {
    section,
    focusedAgentId,
    hoveredAgentId,
    goto,
    focusAgent,
    clearFocus,
    hover,
    statusOf,
    anyRunning,
    orgChart: ORG_CHART,
  }
})
