<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCompanyStore } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { useTraceStore } from '@/stores/trace'
import { useEvaluationStore } from '@/stores/evaluation'
import { useAIStore } from '@/stores/ai'
import { ROLE_LABEL } from '@/types/agent'
import type { ExecutionEvent } from '@/types/execution'
import type { Agent as AgentT } from '@/types/agent'

import AppShell, { type TabKey } from '@/components/layout/AppShell.vue'
import DashboardPanel from '@/components/dashboard/DashboardPanel.vue'
import OfficeBoard from '@/components/office/OfficeBoard.vue'
import TaskBoard from '@/components/task/TaskBoard.vue'
import DependencyGraph from '@/components/task/DependencyGraph.vue'
import ExecutionTimeline from '@/components/execution/ExecutionTimeline.vue'
import AgentDetailPanel from '@/components/agent/AgentDetailPanel.vue'
import ApprovalDialog from '@/components/execution/ApprovalDialog.vue'
import EventDetailDialog from '@/components/execution/EventDetailDialog.vue'

const company = useCompanyStore()
const tasks = useTaskStore()
const traceStore = useTraceStore()
const evaluation = useEvaluationStore()
const ai = useAIStore()

const tab = ref<TabKey>('dashboard')
const selectedAgent = ref<AgentT['id'] | ''>('')
const selectedEvent = ref<ExecutionEvent | null>(null)

function openAgent(id: string): void {
  selectedAgent.value = id
}

const currentStepIdx = computed(() =>
  company.activeScenario.steps.findIndex((s) => s.id === company.currentStepId),
)

// Phase 9 — keep evaluation store in sync with the trace log.
import { watch } from 'vue'
watch(
  () => traceStore.traces,
  (t) => evaluation.syncFrom([...t]),
  { deep: true, immediate: true },
)

/** §56 — real AI stats; null when nothing recorded yet. */
const perf = computed(() => ({
  total: evaluation.total,
  successRate:
    evaluation.successRate === null ? 'N/A' : `${evaluation.successRate}%`,
  avgDuration:
    evaluation.averageDurationSec === null
      ? 'N/A'
      : `${evaluation.averageDurationSec.toFixed(1)} 秒`,
  avgToolCalls:
    evaluation.averageToolCalls === null
      ? 'N/A'
      : evaluation.averageToolCalls.toFixed(1),
  totalTokens:
    evaluation.totalTokens === null ? 'Unavailable' : evaluation.totalTokens.toLocaleString(),
  retries: evaluation.totalRetries,
}))
</script>

<template>
  <AppShell v-model="tab">
    <template #default="{ tab: activeTab }">
      <DashboardPanel v-if="activeTab === 'dashboard'" />

      <OfficeBoard v-else-if="activeTab === 'office'" @select="openAgent" />

      <template v-else-if="activeTab === 'tasks'">
        <TaskBoard />
        <div class="mt-6">
          <DependencyGraph />
        </div>
      </template>

      <!-- 流程總覽 -->
      <section v-else-if="activeTab === 'workflow'" class="card p-5" aria-label="流程總覽">
        <h3 class="text-sm font-semibold">示範流程</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ company.activeScenario.name }} — 共
          {{ company.activeScenario.steps.length }} 個步驟。目前步驟：
          <span class="font-mono">{{ company.currentStepId || '—' }}</span>
        </p>
        <ol class="mt-4 space-y-2">
          <li
            v-for="(step, i) in company.activeScenario.steps"
            :key="step.id"
            class="flex items-start gap-3 rounded-md px-3 py-2 text-sm"
            :class="
              step.id === company.currentStepId
                ? 'bg-accent/10 font-medium'
                : i < currentStepIdx
                  ? 'opacity-60'
                  : ''
            "
          >
            <span class="mt-0.5 font-mono text-xs text-muted-foreground">
              {{ String(i + 1).padStart(2, '0') }}
            </span>
            <span class="min-w-0">
              <span class="block">{{ ROLE_LABEL[step.agentId as keyof typeof ROLE_LABEL] ?? step.agentId }}</span>
              <span class="block text-xs text-muted-foreground">{{ step.title }}</span>
              <span
                v-if="step.approvalRequired"
                class="mt-0.5 inline-block rounded bg-blue-500/10 px-1.5 text-[10px] font-medium text-blue-500"
              >
                需要人工核准
              </span>
              <span
                v-if="step.statusDuring === 'blocked'"
                class="mt-0.5 inline-block rounded bg-red-500/10 px-1.5 text-[10px] font-medium text-red-500"
              >
                阻塞情境
              </span>
            </span>
          </li>
        </ol>
      </section>

      <!-- 評估面板（Phase 9 — 真實 AI 執行統計 §55/56） -->
      <section v-else-if="activeTab === 'evaluation'" class="space-y-6" aria-label="Agent 效能評估">
        <!-- 真實 AI 效能 -->
        <div class="card p-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">AI Performance（真實執行）</h3>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] tracking-wide"
              :class="
                ai.mode === 'real'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{ ai.mode === 'real' ? 'REAL AI' : 'SIMULATION' }}
            </span>
          </div>
          <p v-if="perf.total === 0" class="mt-3 text-xs text-muted-foreground">
            尚無真實 LLM 執行紀錄。使用 Real AI 模式執行專案後，這裡會顯示成功率、耗時與 Token 用量。
          </p>
          <dl v-else class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div><dt class="stat-label">總執行次數</dt><dd class="stat-value">{{ perf.total }}</dd></div>
            <div><dt class="stat-label">成功率</dt><dd class="stat-value">{{ perf.successRate }}</dd></div>
            <div><dt class="stat-label">平均執行時間</dt><dd class="stat-value font-mono">{{ perf.avgDuration }}</dd></div>
            <div><dt class="stat-label">平均工具呼叫</dt><dd class="stat-value">{{ perf.avgToolCalls }}</dd></div>
            <div><dt class="stat-label">重試次數</dt><dd class="stat-value">{{ perf.retries }}</dd></div>
            <div><dt class="stat-label">Token Usage</dt><dd class="stat-value font-mono">{{ perf.totalTokens }}</dd></div>
          </dl>
        </div>

        <!-- 任務面統計（來自 domain store，非偽造） -->
        <div class="card p-5">
          <h3 class="text-sm font-semibold">任務統計</h3>
          <dl class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div><dt class="stat-label">任務完成率</dt><dd class="stat-value">{{ tasks.tasks.length ? Math.round((tasks.completedCount / tasks.tasks.length) * 100) : 0 }}%</dd></div>
            <div><dt class="stat-label">已完成任務</dt><dd class="stat-value">{{ tasks.completedCount }} / {{ tasks.tasks.length }}</dd></div>
            <div><dt class="stat-label">未解 Bug</dt><dd class="stat-value">{{ tasks.bugs.filter((b) => !b.resolved).length }}</dd></div>
          </dl>
        </div>
      </section>
    </template>

    <template #timeline>
      <ExecutionTimeline @select="selectedEvent = $event" />
    </template>

    <template #detail>
      <Transition name="slide">
        <AgentDetailPanel
          v-if="selectedAgent"
          :key="selectedAgent"
          :agent-id="selectedAgent"
          class="absolute inset-y-0 right-0 z-30 shadow-xl"
          @close="selectedAgent = ''"
        />
      </Transition>
    </template>
  </AppShell>

  <ApprovalDialog />
  <EventDetailDialog :event="selectedEvent" @close="selectedEvent = null" />
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
