<script setup lang="ts">
import { useCompanyStore } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { useAgentStore } from '@/stores/agents'
import { useExecutionStore } from '@/stores/execution'
import ProgressBar from '@/components/common/ProgressBar.vue'

const company = useCompanyStore()
const tasks = useTaskStore()
const agents = useAgentStore()
const exec = useExecutionStore()

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour12: false })
}
</script>

<template>
  <div class="space-y-6">
    <!-- 空狀態 -->
    <div v-if="company.runState === 'idle'" class="card p-8 text-center">
      <p class="text-lg font-semibold">目前沒有執行中的專案</p>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        在左側選一個示範情境，然後按<strong>「開始示範」</strong>，
        看看 AI 公司如何一步步完成你的需求！
      </p>
    </div>

    <template v-else>
      <!-- 專案標頭 -->
      <header class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold tracking-tight">{{ company.projectName }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              目前階段：{{ company.phase || '—' }}
            </p>
          </div>
          <span
            v-if="company.runState === 'completed'"
            class="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400"
          >
            ✓ 專案已完成
          </span>
        </div>
        <div class="mt-4 max-w-xl">
          <ProgressBar :model-value="tasks.overallProgress" label="整體進度" show-value />
        </div>
      </header>

      <!-- 統計數據 -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="card p-4">
          <p class="stat-label">工作 Agent 數</p>
          <p class="stat-value">{{ agents.activeCount }}</p>
        </div>
        <div class="card p-4">
          <p class="stat-label">已完成任務</p>
          <p class="stat-value">
            {{ tasks.completedCount
            }}<span class="text-base text-muted-foreground"> / {{ tasks.tasks.length }}</span>
          </p>
        </div>
        <div class="card p-4">
          <p class="stat-label">進行中任務</p>
          <p class="stat-value">{{ tasks.inProgressCount }}</p>
        </div>
        <div class="card p-4">
          <p class="stat-label">已阻塞任務</p>
          <p class="stat-value" :class="tasks.blockedCount > 0 ? 'text-red-500' : ''">
            {{ tasks.blockedCount }}
          </p>
        </div>
      </div>

      <!-- 最近事件 -->
      <section aria-labelledby="recent-events-h" class="card p-5">
        <h3 id="recent-events-h" class="mb-3 text-sm font-semibold">最近的執行事件</h3>
        <ul v-if="exec.events.length" class="space-y-2 font-mono text-xs">
          <li
            v-for="e in exec.events.slice(-6).reverse()"
            :key="e.id"
            class="flex gap-3 rounded-md bg-muted/50 px-3 py-2"
          >
            <time class="shrink-0 tabular-nums text-muted-foreground">
              {{ time(e.timestamp) }}
            </time>
            <span class="font-semibold">{{ e.agentId.toUpperCase() }}</span>
            <span class="truncate text-muted-foreground">{{ e.title }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted-foreground">還沒有事件。</p>
      </section>

      <!-- 使用者需求 -->
      <section aria-labelledby="req-h" class="card p-5">
        <h3 id="req-h" class="mb-2 text-sm font-semibold">使用者需求</h3>
        <pre class="whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed">{{ company.requirement }}</pre>
      </section>
    </template>
  </div>
</template>
