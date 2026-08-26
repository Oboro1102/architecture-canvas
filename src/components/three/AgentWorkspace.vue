<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { useAgentStore } from '@/stores/agents'
import { useTaskStore } from '@/stores/tasks'
import { toLandingStatus, LANDING_STATUS_LABEL, STATUS_VISUAL } from '@/types/landing'
import { ROLE_LABEL } from '@/types/agent'
import type { LandingAgentStatus } from '@/types/landing'

/**
 * Agent Workspace — 點擊 3D 節點後覆蓋在場景右側的工作區面板。
 */
const props = defineProps<{ agentId: string }>()
const emit = defineEmits<{ close: [] }>()

const agents = useAgentStore()
const tasks = useTaskStore()

const agent = computed(() => agents.agents.find((a) => a.id === props.agentId))
const status = computed<LandingAgentStatus>(() =>
  agent.value ? toLandingStatus(agent.value.status) : 'idle',
)
const currentTask = computed(() =>
  agent.value?.currentTaskId ? tasks.getById(agent.value.currentTaskId) : undefined,
)
const agentTasks = computed(() =>
  tasks.tasks.filter((t) => t.assigneeId === props.agentId).slice(0, 6),
)

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}
function glyph(s: string | undefined): string {
  if (s === 'completed') return '✓'
  if (s === 'in_progress') return '▶'
  return '○'
}
</script>

<template>
  <aside
    v-if="agent"
    class="absolute inset-y-0 right-0 z-20 flex w-72 flex-col gap-4 overflow-y-auto border-l border-slate-800 bg-[#0a0d1c]/97 p-5 backdrop-blur md:w-80"
    aria-label="Agent 工作區"
    data-testid="agent-workspace"
  >
    <header class="flex items-start justify-between gap-2">
      <div>
        <h2 class="font-mono text-base font-bold tracking-widest text-white">
          {{ ROLE_LABEL[agent.role] }}
        </h2>
        <p class="text-xs text-slate-400">{{ agent.name }} · {{ agent.department }}</p>
      </div>
      <button
        class="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
        aria-label="返回公司全景"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </header>

    <span
      class="w-fit rounded-full border border-slate-700 px-2.5 py-1 font-mono text-xs tracking-wider"
      :style="{ color: hex(STATUS_VISUAL[status].color) }"
    >
      {{ LANDING_STATUS_LABEL[status] }}
    </span>

    <section v-if="currentTask" aria-label="目前任務">
      <h3 class="mb-1 font-mono text-[10px] tracking-[0.25em] text-slate-500">目前任務</h3>
      <p class="text-sm text-white">{{ currentTask.title }}</p>
      <div
        class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        :aria-valuenow="currentTask.progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`進度 ${currentTask.progress}%`"
      >
        <div
          class="h-full rounded-full bg-cyan-400 transition-all duration-500"
          :style="{ width: `${currentTask.progress}%` }"
        ></div>
      </div>
      <p class="mt-1 text-right font-mono text-xs text-slate-400">{{ currentTask.progress }}%</p>
    </section>

    <section v-if="agentTasks.length" aria-label="任務清單">
      <h3 class="mb-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">任務清單</h3>
      <ul class="space-y-1.5 text-xs">
        <li v-for="t in agentTasks" :key="t.id" class="flex items-start gap-2">
          <span
            class="w-4 shrink-0 text-center font-mono"
            :class="t.status === 'completed' ? 'text-emerald-400' : t.status === 'in_progress' ? 'text-cyan-300' : 'text-slate-500'"
            aria-hidden="true"
          >{{ glyph(t.status) }}</span>
          <span :class="t.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'">
            {{ t.title }}
          </span>
        </li>
      </ul>
    </section>

    <section aria-label="職責">
      <h3 class="mb-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">職責</h3>
      <ul class="space-y-1 text-xs text-slate-400">
        <li v-for="r in agent.responsibilities" :key="r">· {{ r }}</li>
      </ul>
    </section>

    <button
      class="mt-auto shrink-0 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-400"
      @click="emit('close')"
    >
      ← 返回公司全景（Esc）
    </button>
  </aside>
</template>
