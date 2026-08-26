<script setup lang="ts">
import { useCompanyStore } from '@/stores/company'
import { getEngine } from '@/engine/scenarioEngine'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'

const company = useCompanyStore()
const emit = defineEmits<{ close: [] }>()

function select(id: unknown): void {
  const s = company.scenarios.find((x) => x.id === String(id))
  if (!s?.available) return
  if (company.runState === 'running' || company.runState === 'paused') return
  if (company.runState === 'awaiting_approval') return
  company.selectScenario(String(id))
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
    <RadioGroup
      :model-value="company.scenarioId"
      :aria-labelledby="'scenarios-h'"
      @update:model-value="select"
    >
      <Label
        v-for="s in company.scenarios"
        :key="s.id"
        class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-normal transition-colors has-[button[data-state=checked]]:bg-accent/10 has-[button[data-state=checked]]:font-medium has-[button[data-state=checked]]:text-accent hover:bg-muted has-disabled:cursor-not-allowed has-disabled:text-muted-foreground/50"
        :for="`scenario-${s.id}`"
      >
        <RadioGroupItem :id="`scenario-${s.id}`" :value="s.id" :disabled="!s.available" />
        <span class="min-w-0 flex-1 truncate">{{ s.name }}</span>
        <Badge v-if="!s.available" variant="secondary" class="text-[10px]">即將推出</Badge>
      </Label>
    </RadioGroup>
  </section>
</template>
