<script setup lang="ts">
import { useCompanyStore } from '@/stores/company'
import { getEngine } from '@/engine/scenarioEngine'

const company = useCompanyStore()
const emit = defineEmits<{ close: [] }>()

function select(id: string): void {
  const s = company.scenarios.find((x) => x.id === id)
  if (!s?.available) return
  if (company.runState === 'running' || company.runState === 'paused') return
  if (company.runState === 'awaiting_approval') return
  company.selectScenario(id)
  getEngine().reset()
  emit('close')
}
</script>

<template>
  <section aria-labelledby="scenarios-h" class="space-y-1.5">
    <h3
      id="scenarios-h"
      class="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      示範情境
    </h3>
    <button
      v-for="s in company.scenarios"
      :key="s.id"
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:focus-ring"
      :class="
        company.scenarioId === s.id
          ? 'bg-accent/10 font-medium text-accent'
          : s.available
            ? 'text-muted-foreground hover:bg-muted'
            : 'cursor-not-allowed text-muted-foreground/50'
      "
      :disabled="!s.available"
      :aria-pressed="company.scenarioId === s.id"
      @click="select(s.id)"
    >
      <span class="text-xs" aria-hidden="true">{{
        company.scenarioId === s.id ? '●' : '○'
      }}</span>
      <span class="min-w-0 flex-1 truncate">{{ s.name }}</span>
      <span v-if="!s.available" class="rounded bg-muted px-1 text-[10px]">即將推出</span>
    </button>
  </section>
</template>
