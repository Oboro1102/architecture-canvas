<script setup lang="ts">
import { Progress } from '@/components/ui/progress'

defineProps<{
  modelValue: number
  label?: string
  showValue?: boolean
}>()
</script>

<template>
  <div class="w-full">
    <div v-if="label || showValue" class="mb-1 flex items-center justify-between text-xs">
      <span class="text-muted-foreground">{{ label }}</span>
      <span v-if="showValue" class="font-mono tabular-nums">{{ modelValue }}%</span>
    </div>
    <Progress
      :model-value="modelValue"
      class="h-2"
      role="progressbar"
      :aria-valuenow="modelValue"
      :aria-label="label ?? '進度'"
    />
  </div>
</template>
