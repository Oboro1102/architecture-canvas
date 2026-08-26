<script setup lang="ts">
import { useExecutionStore } from '@/stores/execution'
import { useAgentStore } from '@/stores/agents'
import { EVENT_TYPE_LABEL } from '@/types/execution'
import type { ExecutionEvent } from '@/types/execution'

const exec = useExecutionStore()
const agents = useAgentStore()
const emit = defineEmits<{ select: [event: ExecutionEvent] }>()

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour12: false })
}

const typeIcon: Record<string, string> = {
  message: '💬',
  task_created: '📋',
  task_started: '▶',
  task_completed: '✓',
  tool_call: '🔧',
  approval_required: '⏸',
  approval_granted: '✅',
  approval_rejected: '⛔',
  error: '⚠',
}
</script>

<template>
  <div class="flex h-full flex-col">
    <h3 class="px-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground">
      執行時間軸
    </h3>
    <p
      v-if="exec.events.length === 0"
      class="card p-4 text-center text-xs text-muted-foreground"
    >
      還沒有活動紀錄。Agent 工作時事件會即時顯示在這裡。
    </p>
    <TransitionGroup v-else name="event" tag="ol" class="event-scroll space-y-2 overflow-y-auto pr-1">
      <li v-for="e in [...exec.events].reverse()" :key="e.id">
        <button
          class="w-full rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-muted/60 focus-visible:focus-ring"
          :aria-label="`查看事件詳情：${e.title}`"
          @click="emit('select', e)"
        >
          <span class="flex items-baseline gap-2">
            <time class="shrink-0 font-mono tabular-nums text-muted-foreground">
              {{ time(e.timestamp) }}
            </time>
            <span
              class="truncate font-semibold"
              :class="
                e.type === 'error'
                  ? 'text-red-500'
                  : e.type.startsWith('approval')
                    ? 'text-blue-500'
                    : ''
              "
            >
              {{ typeIcon[e.type] ?? '·' }}
              {{ agents.getById(e.agentId)?.name ?? e.agentId }}
            </span>
            <span class="ml-auto shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
              {{ EVENT_TYPE_LABEL[e.type] }}
            </span>
          </span>
          <span class="mt-0.5 block truncate text-muted-foreground">{{ e.title }}</span>
          <!-- §32/§35 — mode provenance, never color-only -->
          <span
            v-if="e.executionMode"
            class="mt-0.5 inline-block rounded px-1 text-[10px] font-medium"
            :class="
              e.executionMode === 'real'
                ? 'bg-accent/15 text-accent'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ e.executionMode === 'real' ? '[Real AI]' : '[Simulation]' }}
          </span>
        </button>
      </li>
    </TransitionGroup>
  </div>
</template>
