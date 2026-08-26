<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { CompanyScene } from '@/three/companyScene'
import { useLandingStore } from '@/stores/landing'
import { useAgentStore } from '@/stores/agents'
import { useCompanyStore } from '@/stores/company'
import { toLandingStatus, LANDING_STATUS_LABEL } from '@/types/landing'
import { ROLE_LABEL_EN, ROLE_LABEL } from '@/types/agent'
import type { LandingAgentStatus } from '@/types/landing'

/**
 * 3D 場景 wrapper — 橋接 Pinia 狀態 → 場景快照，與 hover/click → store。
 * 場景本身不含任何業務邏輯。
 */
const container = ref<HTMLElement | null>(null)
const landing = useLandingStore()
const agents = useAgentStore()
const company = useCompanyStore()

let scene: CompanyScene | null = null
/** 追蹤步驟切換，觸發脈衝波 */
let lastStepId = ''

/** 由 currentStepId 找出當事 Agent（spotlight 目標） */
function spotlightTarget(): string | null {
  if (company.runState !== 'running' && company.runState !== 'paused') return null
  const step = company.activeScenario.steps.find((s) => s.id === company.currentStepId)
  return step?.agentId ?? null
}

function syncSpotlight(): void {
  const target = spotlightTarget()
  scene?.setSpotlight(target)
  // 步驟交接時從新當事節點放出脈衝
  if (target && company.currentStepId && company.currentStepId !== lastStepId) {
    lastStepId = company.currentStepId
    scene?.pulseAt(target)
  }
  if (!target) lastStepId = ''
}

onMounted(() => {
  if (!container.value) return
  scene = new CompanyScene(container.value, {
    onHover: (id) => {
      landing.hover(id ?? '')
      document.body.style.cursor = id ? 'pointer' : ''
    },
    onClick: (id) => landing.focusAgent(id),
  })
  pushStatuses()
})

onBeforeUnmount(() => {
  scene?.dispose()
  scene = null
  document.body.style.cursor = ''
})

function pushStatuses(): void {
  const map: Record<string, LandingAgentStatus> = {}
  for (const a of agents.agents) map[a.id] = toLandingStatus(a.status)
  scene?.setStatuses(map)
}

watch(
  () => agents.agents.map((a) => `${a.id}:${a.status}`).join('|'),
  pushStatuses,
)
// spotlight 跟隨執行步驟
watch(
  () => `${company.runState}:${company.currentStepId}`,
  syncSpotlight,
  { immediate: true },
)
watch(
  () => landing.hoveredAgentId,
  (id) => scene?.setHovered(id || null),
)
watch(
  () => landing.focusedAgentId,
  (id) => scene?.setFocused(id || null),
)

const hoveredAgent = () => agents.agents.find((a) => a.id === landing.hoveredAgentId)
</script>

<template>
  <div
    class="relative h-full w-full"
    role="img"
    :aria-label="`AI 公司組織 3D 場景：${ROLE_LABEL_EN.ceo}、${ROLE_LABEL_EN.product}、${ROLE_LABEL_EN.cto} 等 Agent 節點`"
  >
    <div ref="container" class="absolute inset-0" data-testid="three-container"></div>

    <!-- Hover tooltip（文字，非僅色彩） -->
    <Transition name="fade">
      <div
        v-if="hoveredAgent()"
        class="pointer-events-none absolute bottom-4 left-4 max-w-64 rounded-lg border border-slate-700 bg-[#0a0d1c]/95 p-3 text-xs shadow-lg backdrop-blur"
        data-testid="agent-tooltip"
      >
        <p class="font-mono text-sm font-semibold tracking-wider text-white">
          {{ ROLE_LABEL[hoveredAgent()!.role] }}
        </p>
        <p class="mt-1 text-slate-400">
          {{ hoveredAgent()!.responsibilities.slice(0, 3).join(' · ') }}
        </p>
        <p class="mt-1.5 font-mono text-[10px] tracking-wide text-cyan-300">
          {{ LANDING_STATUS_LABEL[toLandingStatus(hoveredAgent()!.status)] }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
