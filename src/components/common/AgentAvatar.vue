<script setup lang="ts">
import { computed } from 'vue'
import type { AgentStatus } from '@/types/agent'
import { createAgentAvatar } from '@/engine/avatarProvider'

const props = defineProps<{
  seed: string
  status: AgentStatus
  size?: number
}>()

/** 頭像 SVG 由抽象層生成，未來換 provider 只改 avatarProvider.ts */
const svg = computed(() => createAgentAvatar(props.seed))

/** 狀態 → 外框顏色（顏色之外另有動畫輔助，不只靠色彩表達） */
const ringClass = computed(() => {
  switch (props.status) {
    case 'working':
    case 'reviewing':
      return 'ring-emerald-500/60'
    case 'waiting':
      return 'ring-amber-400/60'
    case 'blocked':
      return 'ring-red-500/70'
    case 'completed':
      return 'ring-teal-500/60'
    default:
      return 'ring-border'
  }
})

const ringStyle = computed(() => ({ width: `${props.size ?? 56}px`, height: `${props.size ?? 56}px` }))
</script>

<template>
  <span class="relative inline-block shrink-0" :style="ringStyle" :data-status="status">
    <!-- 圓形頭像 + 狀態外框 -->
    <span
      class="block size-full overflow-hidden rounded-full bg-white/5 p-1 ring-2 transition-colors"
      :class="ringClass"
      v-html="svg"
    />

    <!-- 狀態小裝飾（emoji，不干擾點擊） -->
    <span
      v-if="status === 'working'"
      class="absolute -top-1 -right-1 animate-bounce text-xs"
      aria-hidden="true"
    >⌨️</span>
    <span
      v-else-if="status === 'waiting'"
      class="absolute -top-1 -right-1 animate-pulse text-xs"
      aria-hidden="true"
    >💤</span>
    <span
      v-else-if="status === 'blocked'"
      class="absolute -top-1.5 -right-1.5 animate-bounce text-sm font-bold"
      aria-hidden="true"
    >❗</span>
    <span
      v-else-if="status === 'completed'"
      class="absolute -top-1.5 -right-1.5 text-sm"
      aria-hidden="true"
    >✅</span>
  </span>
</template>
