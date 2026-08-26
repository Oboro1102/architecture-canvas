<script setup lang="ts">
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
    <div
      class="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      :aria-valuenow="modelValue"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label ?? '進度'"
    >
      <div
        class="h-full rounded-full bg-accent transition-all duration-500 ease-out"
        :style="{ width: `${modelValue}%` }"
      />
    </div>
  </div>
</template>
