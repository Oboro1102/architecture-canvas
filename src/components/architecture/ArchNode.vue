<script setup lang="ts">
import { computed } from 'vue'
import { type NodeProps } from '@vue-flow/core'

const props = defineProps<NodeProps>()
const accent = computed(() => (props.data?.accent as string) ?? '#38bdf8')
</script>

<template>
  <div
    class="arch-node"
    :class="{ 'is-selected': props.selected }"
    :style="{
      borderColor: props.selected ? accent : 'rgba(51,71,102,0.9)',
      boxShadow: props.selected
        ? `0 0 0 2px ${accent}, 0 0 18px ${accent}55`
        : 'none',
    }"
  >
    <div
      class="arch-node__glow"
      :style="{
        background: `radial-gradient(120px 60px at 50% 0%, ${accent}22, transparent 70%)`,
      }"
    />
    <div class="arch-node__label">{{ (props.data?.label as string) }}</div>
    <div class="arch-node__type">{{ (props.data?.typeLabel as string) }}</div>
    <div v-if="props.data?.technology" class="arch-node__tech">
      {{ (props.data?.technology as string) }}
    </div>
  </div>
</template>

<style scoped>
.arch-node {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 100%;
  padding: 10px 14px;
  border: 1px solid;
  border-radius: 12px;
  background: linear-gradient(180deg, #14213a 0%, #0e1830 100%);
  color: #e2e8f0;
  cursor: grab;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
}
.arch-node:active {
  cursor: grabbing;
}
.arch-node:hover {
  transform: translateY(-1px);
  border-color: #38bdf8 !important;
}
.arch-node.is-selected {
  transform: translateY(-1px);
}
.arch-node__glow {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  opacity: 0.8;
}
.arch-node__label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.arch-node__type {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7c93b8;
}
.arch-node__tech {
  font-size: 11px;
  color: #38bdf8;
}
</style>
