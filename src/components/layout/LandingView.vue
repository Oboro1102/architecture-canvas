<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { PanelRightClose, PanelRightOpen } from '@lucide/vue'
import { useLandingStore } from '@/stores/landing'
import { useCompanyStore } from '@/stores/company'
import { useExecutionStore } from '@/stores/execution'
import AgentWorkspace from '@/components/three/AgentWorkspace.vue'
import SimulationControls from '@/components/landing/SimulationControls.vue'
import ExecutionTimeline from '@/components/execution/ExecutionTimeline.vue'
import EventDetailDialog from '@/components/execution/EventDetailDialog.vue'
import ApprovalDialog from '@/components/execution/ApprovalDialog.vue'
import SimulationTab from '@/components/landing/SimulationTab.vue'
import OrgTab from '@/components/landing/OrgTab.vue'
import type { ExecutionEvent } from '@/types/execution'

/**
 * V3 — Mission Control 監看式主畫面（取代 landing page 概念）。
 * 3D 公司場景是核心，佔滿主區域；右側固定面板提供控制 / 組織 / 事件。
 * 整頁不捲動：只有面板內部捲動，避免滾動互相干擾。
 */

// Lazy load Three.js heavy component (spec §36)
const CompanyCanvas = defineAsyncComponent(() => import('@/components/three/CompanyCanvas.vue'))

const landing = useLandingStore()
const company = useCompanyStore()
const execStore = useExecutionStore()

type TabKey = 'control' | 'org' | 'events'
const tab = ref<TabKey>('control')
/** 摺疊右側面板 — 專注看 3D 場景 */
const panelOpen = ref(true)

const selectedEvent = ref<ExecutionEvent | null>(null)

const stateLabel = computed(() => {
  const map: Record<string, string> = {
    idle: '待機中',
    running: '執行中',
    paused: '已暫停',
    awaiting_approval: '等待核准',
    completed: '已完成',
  }
  return map[company.runState] ?? company.runState
})
/** navbar 狀態燈：與事件 tab 同一套色彩語言（綠=執行、黃=暫停/等待、紅=錯誤） */
const stateLight = computed<{ cls: string; blink: boolean }>(() => {
  if (eventError.value) return { cls: 'bg-red-500', blink: false }
  if (company.runState === 'running') return { cls: 'bg-emerald-400', blink: true }
  if (company.runState === 'paused' || company.runState === 'awaiting_approval')
    return { cls: 'bg-amber-400', blink: false }
  return { cls: 'bg-slate-500', blink: false }
})

/** 事件 tab 狀態燈：執行中閃爍綠燈、暫停黃燈、錯誤紅燈、完成後消失 */
const eventLight = computed<{ show: boolean; cls: string; label: string }>(() => {
  if (company.runState === 'running') {
    return { show: true, cls: 'bg-emerald-400 animate-pulse-dot', label: '執行中' }
  }
  if (company.runState === 'paused') {
    return { show: true, cls: 'bg-amber-400', label: '已暫停' }
  }
  return { show: false, cls: '', label: '' }
})
/** 錯誤：最近一筆事件為 error 時亮紅燈；等待核准時亮黃燈 */
const eventError = computed(
  () => execStore.events.length > 0 && execStore.events[execStore.events.length - 1]!.type === 'error',
)
const eventLightFinal = computed(() => {
  if (eventError.value) return { show: true, cls: 'bg-red-500', label: '發生錯誤' }
  if (company.runState === 'awaiting_approval') {
    return { show: true, cls: 'bg-amber-400', label: '等待核准' }
  }
  return eventLight.value
})

function focusAgent(id: string): void {
  landing.focusAgent(id)
}

// keyboard: Esc closes agent workspace；面板開關用視覺按鈕（保留 Tab 給鍵盤導航）
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && landing.focusedAgentId) {
    landing.clearFocus()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-[#070912] text-slate-100">
    <!-- ── Top bar ── -->
    <header
      class="z-30 flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0a0d1c] px-4"
    >
      <div class="flex items-center gap-4">
        <h1 class="font-mono text-sm font-bold tracking-[0.25em]">AI COMPANY OS</h1>
        <span
          class="rounded-full border border-slate-700 px-2.5 py-0.5 font-mono text-xs tracking-wide"
          role="status"
          aria-live="polite"
        >
          <span
            class="mr-1.5 inline-block size-2 rounded-full align-middle"
            :class="[stateLight.cls, stateLight.blink ? 'animate-pulse-dot' : '']"
            aria-hidden="true"
          ></span>{{ stateLabel }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <SimulationControls />
        <button
          class="rounded-md border border-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
          :aria-label="panelOpen ? '摺疊控制台面板，專注觀看 3D 場景' : '展開控制台面板'"
          :title="panelOpen ? '摺疊控制台' : '展開控制台'"
          data-testid="toggle-panel"
          @click="panelOpen = !panelOpen"
        >
          <PanelRightClose v-if="panelOpen" class="size-4" />
          <PanelRightOpen v-else class="size-4" />
        </button>
      </div>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <!-- ── 3D stage (core) ── -->
      <main class="relative min-w-0 flex-1" aria-label="AI 公司 3D 場景">
        <CompanyCanvas />

        <!-- focused agent workspace overlays the scene -->
        <Transition name="slide">
          <AgentWorkspace
            v-if="landing.focusedAgentId"
            :agent-id="landing.focusedAgentId"
            @close="landing.clearFocus()"
          />
        </Transition>

        <!-- hint -->
        <p
          v-if="!landing.focusedAgentId && company.runState === 'idle'"
          class="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-1.5 font-mono text-xs text-slate-300 backdrop-blur"
        >
          點擊節點查看 Agent · 按「開始模擬」讓公司動起來
        </p>
      </main>

      <!-- ── Side console (internally scrolled only, collapsible) ── -->
      <Transition name="panel">
        <aside
          v-if="panelOpen"
          class="absolute inset-y-0 right-0 z-20 flex w-72 flex-col border-l border-slate-800 bg-[#0a0d1c]/95 backdrop-blur md:relative md:w-96"
          aria-label="控制台"
        >
          <!-- tab bar -->
          <nav class="flex shrink-0 items-stretch border-b border-slate-800" aria-label="面板分頁">
            <button
              v-for="t in [
                { key: 'control', label: '模擬' },
                { key: 'org', label: '組織' },
                { key: 'events', label: '事件' },
              ]"
              :key="t.key"
              class="flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-400"
              :class="
                tab === t.key
                  ? 'border-b-2 border-cyan-400 text-white'
                  : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
              "
              :aria-selected="tab === t.key"
              role="tab"
              @click="tab = t.key as TabKey"
            >
              {{ t.label }}
              <!-- 事件 tab 狀態燈：執行=閃爍綠 / 暫停·核准=黃 / 錯誤=紅 / 完成=不顯示 -->
              <span
                v-if="t.key === 'events' && eventLightFinal.show"
                class="inline-block size-1.5 rounded-full"
                :class="eventLightFinal.cls"
                role="img"
                :aria-label="`事件：${eventLightFinal.label}`"
                :title="eventLightFinal.label"
              ></span>
            </button>
          </nav>

          <!-- tab content: each handles its own internal scrolling -->
          <div class="min-h-0 flex-1 overflow-hidden" role="tabpanel">
            <SimulationTab v-show="tab === 'control'" @focus-agent="focusAgent" />
            <OrgTab v-show="tab === 'org'" @focus-agent="focusAgent" />
            <div v-show="tab === 'events'" class="h-full overflow-y-auto p-3">
              <ExecutionTimeline @select="(e: ExecutionEvent) => (selectedEvent = e)" />
            </div>
          </div>
        </aside>
      </Transition>
    </div>

    <!-- shared dialogs -->
    <ApprovalDialog />
    <EventDetailDialog :event="selectedEvent" @close="selectedEvent = null" />
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
.panel-enter-active,
.panel-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}
.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
