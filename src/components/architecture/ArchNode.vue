<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, ConnectionMode, type NodeProps } from '@vue-flow/core'

const props = defineProps<NodeProps>()
// Per-node-type accent (e.g. #38bdf8 for database, #34d399 for service). Injected
// as the CSS custom property `--accent` so every node surface (border, glow,
// handles, type/tech text) reads its own hue at REST — not only when selected.
const accent = computed(() => (props.data?.accent as string) ?? '#38bdf8')
</script>

<template>
  <div
    class="arch-node"
    :class="{ 'is-selected': props.selected }"
    :style="{ '--accent': accent }"
  >
    <div class="arch-node__glow" />
    <div class="arch-node__label">{{ (props.data?.label as string) }}</div>
    <div class="arch-node__type">{{ (props.data?.typeLabel as string) }}</div>
    <div v-if="props.data?.technology" class="arch-node__tech">
      {{ (props.data?.technology as string) }}
    </div>

    <!-- Connection handles. Loose mode lets any handle act as source or target,
         so the user can drag a line from whichever side is convenient. -->
    <Handle
      type="target"
      :position="Position.Left"
      :connection-mode="ConnectionMode.Loose"
      class="arch-handle"
    />
    <Handle
      type="source"
      :position="Position.Right"
      :connection-mode="ConnectionMode.Loose"
      class="arch-handle"
    />
    <Handle
      type="target"
      :position="Position.Top"
      :connection-mode="ConnectionMode.Loose"
      class="arch-handle"
    />
    <Handle
      type="source"
      :position="Position.Bottom"
      :connection-mode="ConnectionMode.Loose"
      class="arch-handle"
    />
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
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 12px;
  /* Faint accent wash at the top so each node-group reads with its own hue. */
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 12%, #0e1830) 0%,
    #0e1830 60%
  );
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
  border-color: var(--accent);
}
.arch-node.is-selected {
  transform: translateY(-1px);
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 22px color-mix(in srgb, var(--accent) 40%, transparent);
}
.arch-node__glow {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  opacity: 0.8;
  background: radial-gradient(
    120px 60px at 50% 0%,
    color-mix(in srgb, var(--accent) 18%, transparent),
    transparent 70%
  );
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
  color: color-mix(in srgb, var(--accent) 75%, #e2e8f0);
}
.arch-node__tech {
  font-size: 11px;
  color: var(--accent);
}
/* Connection handles: hidden until the node is hovered/selected, then they
   fade in as small accent dots on each side. */
.arch-handle {
  width: 9px;
  height: 9px;
  border: 2px solid #0b1220;
  border-radius: 9999px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.arch-node:hover .arch-handle,
.arch-node.is-selected .arch-handle {
  opacity: 1;
}
</style>
