<script setup lang="ts">
import { useAgentStore } from '@/stores/agents'
import StatusBadge from '@/components/common/StatusBadge.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import { ROLE_LABEL } from '@/types/agent'

const emit = defineEmits<{ select: [agentId: string] }>()
const agents = useAgentStore()

// 辦公室平面圖：執行長在最上面，下面是各部門成員
const ceo = agents.agents[0]!
const staff = agents.agents.slice(1)

function seatClass(status: string): string {
  switch (status) {
    case 'working':
    case 'reviewing':
      return 'border-emerald-500/40 shadow-[0_0_12px_-4px] shadow-emerald-500/30'
    case 'blocked':
      return 'border-red-500/50 bg-red-500/5'
    case 'completed':
      return 'border-teal-500/40'
    default:
      return ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 執行長辦公室 -->
    <div class="flex justify-center">
      <button
        class="agent-card w-full max-w-xs flex-col !items-center gap-2 py-4"
        :class="seatClass(ceo.status)"
        @click="emit('select', ceo.id)"
      >
        <AgentAvatar :seed="ceo.id" :status="ceo.status" :size="64" />
        <span class="text-center">
          <span class="block text-sm font-semibold">{{ ROLE_LABEL[ceo.role] }}</span>
          <StatusBadge :status="ceo.status" class="mt-1" />
        </span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="agent in staff"
        :key="agent.id"
        class="agent-card"
        :class="seatClass(agent.status)"
        :aria-label="`開啟${ROLE_LABEL[agent.role]}的詳細資訊`"
        @click="emit('select', agent.id)"
      >
        <AgentAvatar :seed="agent.id" :status="agent.status" />
        <span class="min-w-0 text-left">
          <span class="block truncate text-sm font-semibold">{{ ROLE_LABEL[agent.role] }}</span>
          <span class="mb-1 block truncate text-xs text-muted-foreground">
            {{ agent.name }} · {{ agent.department }}
          </span>
          <StatusBadge :status="agent.status" />
        </span>
      </button>
    </div>

    <p
      v-if="agents.agents.every((a) => a.status === 'idle')"
      class="text-center text-sm text-muted-foreground"
    >
      所有 Agent 目前都在閒置中。按「開始示範」看看他們怎麼工作！
    </p>

    <!-- 圖例：狀態不只靠顏色表達，也附文字說明 -->
    <ul
      class="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground"
      aria-label="狀態圖例"
    >
      <li><span class="mr-1 inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true" />工作中（閃爍）</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-amber-400" aria-hidden="true" />等待中</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-red-500" aria-hidden="true" />已阻塞</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-teal-500" aria-hidden="true" />已完成</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-zinc-400" aria-hidden="true" />閒置</li>
    </ul>
  </div>
</template>
