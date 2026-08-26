<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_LABEL, type AgentStatus } from '@/types/agent'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{ status: AgentStatus }>()

const config = computed<Record<AgentStatus, { dot: string; text: string }>>(() => ({
  idle: { dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400' },
  working: {
    dot: 'bg-emerald-500 animate-pulse-dot',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  waiting: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  blocked: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  reviewing: {
    dot: 'bg-blue-500 animate-pulse-dot',
    text: 'text-blue-600 dark:text-blue-400',
  },
  completed: { dot: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400' },
}))

const c = computed(() => config.value[props.status])
</script>

<template>
  <Badge variant="outline" class="gap-1.5 py-0.5" :class="c.text" role="status">
    <span class="size-2 rounded-full" :class="c.dot" aria-hidden="true" />
    {{ STATUS_LABEL[status] }}
  </Badge>
</template>
