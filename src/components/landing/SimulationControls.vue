<script setup lang="ts">
import { useCompanyStore } from '@/stores/company'
import { getEngine } from '@/engine/scenarioEngine'

/**
 * 模擬控制按鈕組 — 放在 navbar：面板關閉時仍可操作模擬。
 * Start / Pause / Resume / Reset（速率控制在畫布右下角）。
 */
const company = useCompanyStore()

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
  <div class="flex items-center gap-1.5" data-testid="navbar-simulation-controls">
    <!-- 閒置／完成 → 開始 -->
    <button
      v-if="company.runState === 'idle' || company.runState === 'completed'"
      class="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
      data-testid="start-simulation"
      @click="start"
    >
      ▶ 開始模擬
    </button>
    <!-- 執行中 → 暫停／重置 -->
    <template v-else>
      <button
        v-if="company.runState !== 'awaiting_approval'"
        class="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
        data-testid="pause-resume"
        @click="pauseResume"
      >
        {{ company.runState === 'running' ? '⏸ 暫停' : '▶ 繼續' }}
      </button>
      <button
        class="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
        data-testid="reset-simulation"
        @click="reset"
      >
        ↺ 重置
      </button>
    </template>
  </div>
</template>
