<script setup lang="ts">
import { computed } from 'vue'
import { useCompanyStore, RUN_STATE_LABEL } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { useAgentStore } from '@/stores/agents'
import { getEngine } from '@/engine/scenarioEngine'
import { STATUS_LABEL } from '@/types/agent'
import ProgressBar from '@/components/common/ProgressBar.vue'

/**
 * 模擬控制分頁 — Start / Pause / Reset、速率調整、進度與 Agent 執行清單。
 */
const emit = defineEmits<{ 'focus-agent': [id: string] }>()

const company = useCompanyStore()
const tasks = useTaskStore()
const agentsStore = useAgentStore()
const agents = computed(() => agentsStore.agents)

const running = computed(() => company.runState === 'running')
const progress = computed({
  get: () => tasks.overallProgress,
  set: () => {
    /* read-only display */
  },
})

const speeds = [0.5, 1, 2, 4, 8]
function setSpeed(v: number): void {
  company.setSpeed(v)
}

function start(): void {
  getEngine().start(company.scenarioId)
}
function pauseResume(): void {
  const e = getEngine()
  if (company.runState === 'running') e.pause()
  else if (company.runState === 'paused') e.resume()
}
function reset(): void {
  getEngine().reset()
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-4" data-testid="simulation-panel">
    <div>
      <h2 class="text-sm font-semibold text-white">模擬控制</h2>
      <p class="mt-0.5 font-mono text-xs text-slate-400">{{ company.activeScenario.name }}</p>
    </div>

    <!-- controls -->
    <div class="flex gap-2">
      <button
        v-if="company.runState === 'idle' || company.runState === 'completed'"
        class="flex-1 rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        data-testid="start-simulation"
        @click="start"
      >
        ▶ 開始模擬
      </button>
      <template v-else>
        <button
          class="flex-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
          data-testid="pause-resume"
          @click="pauseResume"
        >
          {{ running ? '⏸ 暫停' : '▶ 繼續' }}
        </button>
        <button
          class="flex-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
          @click="reset"
        >
          ↺ 重置
        </button>
      </template>
    </div>

    <!-- speed control -->
    <section aria-label="模擬速率">
      <h3 class="mb-1.5 font-mono text-[10px] tracking-[0.25em] text-slate-500">速率</h3>
      <div class="flex gap-1" role="group" aria-label="選擇模擬速率">
        <button
          v-for="s in speeds"
          :key="s"
          class="flex-1 rounded-md border px-1 py-1.5 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
          :class="
            company.speed === s
              ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
              : 'border-slate-700 text-slate-400 hover:bg-slate-800'
          "
          :aria-pressed="company.speed === s"
          @click="setSpeed(s)"
        >
          {{ s }}×
        </button>
      </div>
    </section>

    <template v-if="company.runState !== 'idle'">
      <!-- progress -->
      <section aria-label="整體進度">
        <div class="mb-1 flex items-center justify-between font-mono text-xs">
          <span class="text-slate-400">{{ RUN_STATE_LABEL[company.runState] }}</span>
          <span class="text-white">{{ tasks.overallProgress }}%</span>
        </div>
        <ProgressBar v-model="progress" />
        <p class="mt-1 font-mono text-[11px] text-slate-400">
          {{ tasks.completedCount }}/{{ tasks.tasks.length }} 任務完成 · 階段：{{ company.phase || '—' }}
        </p>
      </section>

      <!-- agent pipeline -->
      <section aria-label="Agent 執行狀態">
        <h3 class="mb-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">AGENT 狀態</h3>
        <ol class="space-y-1">
          <li v-for="a in agents" :key="a.id">
            <button
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:outline-cyan-400"
              :class="a.status !== 'idle' ? 'text-white' : 'text-slate-400'"
              @click="emit('focus-agent', a.id)"
            >
              <span aria-hidden="true">{{
                a.status === 'completed'
                  ? '✓'
                  : a.status === 'working' || a.status === 'reviewing'
                    ? '▶'
                    : a.status === 'waiting'
                      ? '⏸'
                      : '○'
              }}</span>
              <span>{{ a.avatar }} {{ a.name }}</span>
              <span class="ml-auto text-[10px]" :class="a.status !== 'idle' ? 'text-cyan-300' : ''">
                {{ STATUS_LABEL[a.status] }}
              </span>
            </button>
          </li>
        </ol>
      </section>
    </template>

    <template v-else>
      <p class="text-xs leading-relaxed text-slate-400">
        按下「開始模擬」，AI 公司會依序執行需求分析 → 設計 → 實作 → QA → 核准。
        過程中 3D 場景會即時反映每個 Agent 的狀態，事件記錄在「事件」分頁。
      </p>
      <p class="mt-auto rounded-md border border-slate-800 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
        模擬模式：免 API Key、離線可重複執行。
      </p>
    </template>
  </div>
</template>
