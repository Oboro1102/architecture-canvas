<script setup lang="ts">
import { computed } from 'vue'
import { type NodeProps } from '@vue-flow/core'

const props = defineProps<NodeProps>()
const accent = computed(() => (props.data?.accent as string) ?? '#64748b')
</script>

<template>
  <div
    class="arch-group"
    :class="{ 'is-selected': props.selected }"
    :style="{
      borderColor: props.selected ? accent : 'rgba(71,90,122,0.55)',
      boxShadow: props.selected ? `0 0 0 1px ${accent}, 0 0 18px ${accent}44` : 'none',
    }"
  >
    <div class="arch-group__header" :style="{ color: accent }">
      <span class="arch-group__dot" :style="{ background: accent }" />
      <span class="arch-group__label">{{ (props.data?.label as string) || '群組' }}</span>
      <span class="arch-group__type">{{ (props.data?.typeLabel as string) }}</span>
    </div>
    <div v-if="props.data?.description" class="arch-group__desc">
      {{ (props.data?.description as string) }}
    </div>
  </div>
</template>

<style scoped>
.arch-group {
  position: relative;
  width: 100%;
  height: 100%;
  border: 1.5px dashed;
  border-radius: 16px;
  background: rgba(148, 163, 184, 0.04);
  pointer-events: all;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.arch-group__header {
  position: absolute;
  top: 10px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  user-select: none;
}
.arch-group__dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
}
.arch-group__label {
  font-weight: 700;
  color: #e2e8f0;
}
.arch-group__type {
  color: #7c93b8;
  font-size: 10px;
}
.arch-group__desc {
  position: absolute;
  left: 14px;
  bottom: 10px;
  max-width: calc(100% - 28px);
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
