<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { EVENT_TYPE_LABEL } from '@/types/execution'
import type { ExecutionEvent } from '@/types/execution'
import { useEscapeToClose } from '@/utils/useEscapeToClose'

const props = defineProps<{ event: ExecutionEvent | null }>()
const emit = defineEmits<{ close: [] }>()

useEscapeToClose(() => props.event !== null, () => emit('close'))

const TRACE_KEYS = [
  'provider',
  'model',
  'promptVersion',
  'durationMs',
  'retries',
  'inputTokens',
  'outputTokens',
  'totalTokens',
] as const

const LABELS: Record<string, string> = {
  provider: 'Provider',
  model: 'Model',
  promptVersion: 'Prompt 版本',
  durationMs: '執行時間',
  retries: '重試次數',
  inputTokens: 'Input Tokens',
  outputTokens: 'Output Tokens',
  totalTokens: 'Total Tokens',
}

function formatValue(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return 'N/A' // §29 — never fabricated
  if (key === 'durationMs') return `${(Number(value) / 1000).toFixed(1)} 秒`
  return String(value)
}

/** Trace fields present on real events; mock events show N/A rows (§29/§56). */
const traceEntries = computed(() =>
  props.event?.executionMode === 'real'
    ? TRACE_KEYS.map((k) => ({
        key: k,
        label: LABELS[k] ?? k,
        value: formatValue(k, props.event?.metadata?.[k]),
      }))
    : [],
)

/** Any other metadata (nextAction, createdTasks…). */
const metaEntries = computed(() => {
  const meta = props.event?.metadata ?? {}
  return Object.entries(meta).filter(([k]) => !TRACE_KEYS.includes(k as never))
})
</script>

<template>
  <Transition name="modal">
    <div
      v-if="event"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
      @click.self="emit('close')"
    >
      <div class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <header class="flex items-start justify-between gap-3">
          <h2 id="event-detail-title" class="text-sm font-semibold">{{ event.title }}</h2>
          <button class="icon-btn" aria-label="關閉事件詳情" @click="emit('close')">
            <X class="size-4" aria-hidden="true" />
          </button>
        </header>

        <!-- Mode provenance (§32) -->
        <p
          v-if="event.executionMode"
          class="mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="
            event.executionMode === 'real'
              ? 'bg-accent/15 text-accent'
              : 'bg-muted text-muted-foreground'
          "
        >
          {{ event.executionMode === 'real' ? '[Real AI]' : '[Simulation]' }}
        </p>

        <dl class="mt-3 space-y-2 text-xs">
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted-foreground">時間</dt>
            <dd class="font-mono">
              {{ new Date(event.timestamp).toLocaleString('zh-TW', { hour12: false }) }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted-foreground">Agent</dt>
            <dd>{{ event.agentId }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted-foreground">類型</dt>
            <dd>{{ EVENT_TYPE_LABEL[event.type] }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted-foreground">內容</dt>
            <dd class="whitespace-pre-wrap">{{ event.description }}</dd>
          </div>
        </dl>

        <!-- Execution Trace (§29) -->
        <div v-if="traceEntries.length" class="mt-4 rounded-md border border-border p-3">
          <h3 class="detail-label">Execution Trace</h3>
          <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div v-for="t in traceEntries" :key="t.key" class="flex gap-2">
              <dt class="shrink-0 text-muted-foreground">{{ t.label }}</dt>
              <dd class="truncate font-mono">{{ t.value }}</dd>
            </div>
          </dl>
        </div>
        <p
          v-else-if="event.executionMode === 'mock'"
          class="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground"
        >
          模擬執行 — Provider / Model / Token Usage：N/A（無真實 LLM 呼叫）
        </p>

        <dl v-if="metaEntries.length" class="mt-3 space-y-2 text-xs">
          <div v-for="[k, v] in metaEntries" :key="k" class="flex gap-2">
            <dt class="w-24 shrink-0 text-muted-foreground">{{ k }}</dt>
            <dd>{{ String(v) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </Transition>
</template>
