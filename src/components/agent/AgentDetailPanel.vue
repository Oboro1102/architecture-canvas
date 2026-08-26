<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { useAgentStore } from '@/stores/agents'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
import { useAIStore } from '@/stores/ai'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { ROLE_LABEL } from '@/types/agent'
import type { Agent as AgentT } from '@/types/agent'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{ agentId: string }>()
const emit = defineEmits<{ close: [] }>()

const agents = useAgentStore()
const tasks = useTaskStore()
const exec = useExecutionStore()
const ai = useAIStore()

const agent = computed<AgentT>(
  () => agents.agents.find((a) => a.id === props.agentId)!,
)
const currentTask = computed(() =>
  agent.value.currentTaskId ? tasks.getById(agent.value.currentTaskId) : undefined,
)
const recentEvents = computed(() =>
  exec.events.filter((e) => e.agentId === props.agentId).slice(-5).reverse(),
)

function onModeChange(mode: string | number): void {
  ai.setAgentMode(agent.value.id, mode as 'global' | 'mock' | 'real')
}
</script>

<template>
  <aside
    v-if="agent"
    class="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-border bg-card p-5 sm:max-w-sm"
    aria-label="Agent 詳細資訊面板"
  >
    <header class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-3">
        <span class="text-3xl" aria-hidden="true">{{ agent.avatar }}</span>
        <div>
          <h2 class="text-base font-semibold">{{ ROLE_LABEL[agent.role] }}</h2>
          <p class="text-xs text-muted-foreground">{{ agent.name }} · {{ agent.department }}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="關閉詳細資訊面板"
        @click="emit('close')"
      >
        <X aria-hidden="true" />
      </Button>
    </header>

    <div>
      <h3 class="detail-label">目前狀態</h3>
      <StatusBadge :status="agent.status" />
    </div>

    <div>
      <h3 class="detail-label">目前任務</h3>
      <p v-if="currentTask" class="text-sm">
        {{ currentTask.title }}
        <span class="font-mono text-xs text-muted-foreground">（{{ currentTask.id }}）</span>
      </p>
      <p v-else class="text-sm text-muted-foreground">目前沒有執行中的任務。</p>
      <div v-if="currentTask && currentTask.status !== 'completed'" class="mt-2">
        <ProgressBar :model-value="currentTask.progress" show-value label="任務進度" />
      </div>
    </div>

    <div>
      <h3 class="detail-label">執行模式（§37 Per-Agent Mode）</h3>
      <div class="flex items-center gap-2">
        <Select
          :model-value="ai.agentModes[agent.id] ?? 'global'"
          @update:model-value="onModeChange($event as string)"
        >
          <SelectTrigger
            size="sm"
            :aria-label="`${ROLE_LABEL[agent.role]} 的執行模式`"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">跟隨全域</SelectItem>
            <SelectItem value="mock">模擬</SelectItem>
            <SelectItem value="real">Real AI</SelectItem>
          </SelectContent>
        </Select>
        <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" role="status">
          實際：{{ ai.effectiveModeFor(agent.id) === 'real' ? 'REAL AI' : 'SIMULATION' }}
        </span>
      </div>
    </div>

    <div>
      <h3 class="detail-label">職責</h3>
      <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        <li v-for="r in agent.responsibilities" :key="r">{{ r }}</li>
      </ul>
    </div>

    <div class="min-h-0 flex-1">
      <h3 class="detail-label">最近活動</h3>
      <ul v-if="recentEvents.length" class="space-y-1.5 text-xs">
        <li v-for="e in recentEvents" :key="e.id" class="flex gap-2">
          <span aria-hidden="true">{{
            e.type === 'task_completed' ? '✓' : e.type === 'task_started' ? '●' : '·'
          }}</span>
          <span class="min-w-0">
            <span class="block truncate">{{ e.title }}</span>
          </span>
        </li>
      </ul>
      <p v-else class="text-xs text-muted-foreground">還沒有活動紀錄。</p>
    </div>
  </aside>
</template>
