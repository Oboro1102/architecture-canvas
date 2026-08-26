<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCompanyStore } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
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
const exec = useExecutionStore()

const tab = ref<TabKey>('dashboard')
const selectedAgent = ref<AgentT['id'] | ''>('')
const selectedEvent = ref<ExecutionEvent | null>(null)

function openAgent(id: string): void {
  selectedAgent.value = id
}

// ── 評估面板（模擬資料，已明確標示）──────────────
const evalData = computed(() => {
  const interventions = exec.events.filter((e) => e.type === 'approval_required').length || 1
  const failed = tasks.bugs.filter((b) => !b.resolved).length
  return {
    taskSuccess: 92,
    taskCompletion: tasks.tasks.length
      ? Math.round((tasks.completedCount / tasks.tasks.length) * 100)
      : 89,
    workflowSuccess: 94,
    avgTaskTime: '12.4 秒',
    failedTasks: failed,
    humanInterventions: interventions,
  }
})

const currentStepIdx = computed(() =>
  company.activeScenario.steps.findIndex((s) => s.id === company.currentStepId),
)
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

      <!-- 評估面板 -->
      <section v-else-if="activeTab === 'evaluation'" class="card p-5" aria-label="Agent 效能評估">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Agent 效能評估</h3>
          <span
            class="rounded-full bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground"
          >
            ※ 模擬資料，非真實 AI 評估
          </span>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div><dt class="stat-label">任務成功率</dt><dd class="stat-value">{{ evalData.taskSuccess }}%</dd></div>
          <div><dt class="stat-label">任務完成率</dt><dd class="stat-value">{{ evalData.taskCompletion }}%</dd></div>
          <div><dt class="stat-label">流程成功率</dt><dd class="stat-value">{{ evalData.workflowSuccess }}%</dd></div>
          <div><dt class="stat-label">平均任務時間</dt><dd class="stat-value font-mono">{{ evalData.avgTaskTime }}</dd></div>
          <div><dt class="stat-label">失敗任務數</dt><dd class="stat-value">{{ evalData.failedTasks }}</dd></div>
          <div><dt class="stat-label">人工介入次數</dt><dd class="stat-value">{{ evalData.humanInterventions }}</dd></div>
        </dl>
        <p class="mt-4 text-xs text-muted-foreground">
          這些數值為模擬資料，不代表真實 AI 評估結果。
        </p>
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
