<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { CompanyEngine } from '@/canvas/CanvasEngine'
import { useLandingStore } from '@/stores/landing'
import { useAgentStore } from '@/stores/agents'
import { useCompanyStore } from '@/stores/company'
import { toLandingStatus, LANDING_STATUS_LABEL } from '@/types/landing'
import { ROLE_LABEL_EN, ROLE_LABEL } from '@/types/agent'
import type { LandingAgentStatus } from '@/types/landing'
import type { WorkflowEvent } from '@/canvas/types/workflow'

/**
 * Canvas 視覺層 wrapper — 橋接 Pinia 狀態 → 引擎快照。
 * 步驟推進時組出 WorkflowEvent 餵給引擎（Mock/Real 共用同一入口）。
 * hover tooltip 跟著節點座標走；click 只聚焦鏡頭，不再開工作區。
 */
const container = ref<HTMLElement | null>(null)
const landing = useLandingStore()
const agents = useAgentStore()
const company = useCompanyStore()

const speeds = [0.5, 1, 2, 4, 8]
function setSpeed(v: number): void {
  company.setSpeed(v)
}

let engine: CompanyEngine | null = null
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
  engine?.setSpotlight(target)
  // 步驟交接 → 組 WorkflowEvent（spec §29）：agent-start + data-flow
  if (target && company.currentStepId && company.currentStepId !== lastStepId) {
    const prev = lastStepId
    lastStepId = company.currentStepId
    const now = Date.now()
    const events: WorkflowEvent[] = [
      { id: `${company.currentStepId}-start`, type: 'agent-start', sourceId: target, timestamp: now },
    ]
    if (prev) {
      events.push({
        id: `${company.currentStepId}-flow`,
        type: 'data-flow',
        sourceId: prev,
        targetId: target,
        timestamp: now,
      })
    }
    for (const e of events) engine?.handleEvent(e)
    engine?.pulseAt(target)
  }
  if (!target) lastStepId = ''
}

onMounted(() => {
  if (!container.value) return
  engine = new CompanyEngine(container.value, {
    onHover: (id: string | null, sx: number, sy: number) => {
      const agentId = id?.startsWith('tool-') ? id.replace('tool-', '') : (id ?? '')
      landing.hover(agentId)
      document.body.style.cursor = id ? 'pointer' : ''
      // tooltip 跟著節點附近的位置（畫布座標）
      if (id) {
        tooltipX.value = sx + 14
        tooltipY.value = sy - 8
      }
    },
    onClick: (id: string) => {
      // 點擊只做鏡頭聚焦，不開工作區
      engine?.focusOn(id)
    },
  })
  pushStatuses()
  engine.fitCompany()
})

onBeforeUnmount(() => {
  engine?.dispose()
  engine = null
  document.body.style.cursor = ''
})

function pushStatuses(): void {
  const map: Record<string, LandingAgentStatus> = {}
  for (const a of agents.agents) map[a.id] = toLandingStatus(a.status)
  // 全域執行狀態覆寫：暫停／等待核准時，所有節點應顯示「暫停」，
  // 而非各自殘留的 working（與事件 tab 狀態燈同一套語言）
  if (company.runState === 'paused' || company.runState === 'awaiting_approval') {
    for (const id of Object.keys(map)) map[id] = 'waiting'
  }
  engine?.setStatuses(map)
}

watch(
  () => agents.agents.map((a) => `${a.id}:${a.status}`).join('|'),
  pushStatuses,
)
// 執行狀態改變也要同步節點顯示
watch(
  () => company.runState,
  pushStatuses,
)
// spotlight 跟隨執行步驟
watch(
  () => `${company.runState}:${company.currentStepId}`,
  syncSpotlight,
  { immediate: true },
)
// 跟隨模式開啟時，角色切換畫布自動聚焦到當事 Agent
watch(
  () => company.currentStepId,
  () => {
    if (followActive.value) {
      const t = spotlightTarget()
      if (t) engine?.focusOn(t)
    }
  },
)
watch(
  () => landing.hoveredAgentId,
  (id) => engine?.setHovered(id || null),
)

/** 聚焦當事 Agent / 顯示整體網絡控制（spec §31） */
const followActive = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

function toggleFollow(): void {
  followActive.value = !followActive.value
  if (followActive.value) {
    const t = spotlightTarget()
    if (t) engine?.focusOn(t)
  } else {
    engine?.fitCompany()
  }
}
function fitCompany(): void {
  // 手動看全景時順帶關掉跟隨，避免兩個意圖打架
  followActive.value = false
  engine?.fitCompany()
}

const hoveredAgent = () => agents.agents.find((a) => a.id === landing.hoveredAgentId)
</script>

<template>
  <div
    class="relative h-full w-full"
    role="img"
    :aria-label="`AI 公司神經工作流：${ROLE_LABEL_EN.ceo}、${ROLE_LABEL_EN.product}、${ROLE_LABEL_EN.cto} 等 Agent 節點`"
  >
    <div ref="container" class="absolute inset-0" data-testid="three-container"></div>

    <!-- 聚焦跟隨 / 全景 / 速率控制 -->
    <div class="absolute right-3 bottom-3 flex flex-col items-end gap-2">
      <!-- 速率 -->
      <div
        class="flex items-center gap-0.5 rounded-lg border border-slate-600 bg-[#0a0d1c]/90 p-1 backdrop-blur"
        role="group"
        aria-label="選擇模擬速率"
      >
        <span class="px-1.5 text-[10px] font-medium text-slate-500">速率</span>
        <button
          v-for="s in speeds"
          :key="s"
          class="rounded-md px-2 py-1.5 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
          :class="
            company.speed === s
              ? 'bg-cyan-500/15 text-cyan-300'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          "
          :aria-pressed="company.speed === s"
          :data-testid="`speed-${s}`"
          @click="setSpeed(s)"
        >
          {{ s }}×
        </button>
      </div>
      <div class="flex gap-2">
        <button
          class="flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors"
          :class="
            followActive
              ? 'border-cyan-400/80 bg-cyan-950/70 text-cyan-300'
              : 'border-slate-600 bg-[#0a0d1c]/90 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-300'
          "
          :aria-pressed="followActive"
          data-testid="focus-active-btn"
          @click="toggleFollow"
        >
          <span aria-hidden="true">◎</span>
          <span>聚焦當事 Agent</span>
          <!-- 滑動開關 -->
          <span
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
            :class="followActive ? 'bg-cyan-500' : 'bg-slate-600'"
            aria-hidden="true"
          >
            <span
              class="inline-block size-3.5 rounded-full bg-white shadow transition-transform"
              :class="followActive ? 'translate-x-[18px]' : 'translate-x-[3px]'"
            ></span>
          </span>
        </button>
        <button
          class="rounded-lg border border-slate-600 bg-[#0a0d1c]/90 px-3.5 py-2 text-xs font-medium text-slate-300 backdrop-blur transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
          data-testid="fit-company-btn"
          @click="fitCompany"
        >
          ⤢ 顯示全景
        </button>
      </div>
    </div>

    <!-- Hover tooltip：浮動在節點旁，非固定角落 -->
    <Transition name="fade">
      <div
        v-if="hoveredAgent()"
        class="pointer-events-none absolute z-10 max-w-64 rounded-lg border border-slate-700 bg-[#05070b]/95 p-3 font-mono text-xs shadow-lg backdrop-blur"
        data-testid="agent-tooltip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      >
        <p class="text-sm font-semibold tracking-wider text-white">
          {{ ROLE_LABEL[hoveredAgent()!.role] }}
        </p>
        <p class="mt-1 text-slate-400">
          {{ hoveredAgent()!.responsibilities.slice(0, 3).join(' · ') }}
        </p>
        <p class="mt-1.5 text-[10px] tracking-wide text-cyan-300">
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
