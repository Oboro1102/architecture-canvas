<script setup lang="ts">
import { useAgentStore } from '@/stores/agents'
import { toLandingStatus, LANDING_STATUS_LABEL, STATUS_VISUAL } from '@/types/landing'
import { ROLE_LABEL } from '@/types/agent'
import type { LandingAgentStatus } from '@/types/landing'

/**
 * 組織分頁 — 七位 Agent 的狀態總覽，點擊聚焦 3D 節點。
 * 狀態以文字 + 符號呈現，不以顏色為唯一依據（spec §37）。
 */
const emit = defineEmits<{ 'focus-agent': [id: string] }>()
const agents = useAgentStore()

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}
function statusOf(s: string): LandingAgentStatus {
  return toLandingStatus(s as Parameters<typeof toLandingStatus>[0])
}
</script>

<template>
  <div class="h-full overflow-y-auto p-4">
    <h2 class="text-sm font-semibold text-white">公司組織</h2>
    <p class="mt-0.5 text-xs text-slate-400">人類定義目標，Agents 執行工作。</p>

    <ul class="mt-4 space-y-2">
      <li v-for="a in agents.agents" :key="a.id">
        <button
          class="w-full rounded-lg border border-slate-800 p-3 text-left transition-colors hover:border-cyan-500/40 hover:bg-slate-800/50 focus-visible:outline-2 focus-visible:outline-cyan-400"
          @click="emit('focus-agent', a.id)"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ backgroundColor: hex(STATUS_VISUAL[statusOf(a.status)].color) }"
              aria-hidden="true"
            ></span>
            <span class="font-mono text-xs tracking-wider text-white">
              {{ ROLE_LABEL[a.role] }}
            </span>
            <span class="ml-auto font-mono text-[10px] tracking-wide" :style="{ color: hex(STATUS_VISUAL[statusOf(a.status)].color) }">
              {{ LANDING_STATUS_LABEL[statusOf(a.status)] }}
            </span>
          </div>
          <p class="mt-1.5 pl-[18px] text-[11px] leading-relaxed text-slate-400">
            {{ a.name }} · {{ a.responsibilities.slice(0, 2).join('、') }}
          </p>
        </button>
      </li>
    </ul>
  </div>
</template>
