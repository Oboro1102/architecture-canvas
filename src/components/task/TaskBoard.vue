<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { TASK_STATUS_LABEL, PRIORITY_LABEL } from '@/types/task'
import { ROLE_LABEL } from '@/types/agent'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { TaskStatus, Task } from '@/types/task'

const tasks = useTaskStore()

const columns: Array<{ key: TaskStatus; label: string }> = (
  ['backlog', 'pending', 'in_progress', 'review', 'blocked', 'completed'] as TaskStatus[]
).map((key) => ({ key, label: TASK_STATUS_LABEL[key] }))

const byColumn = computed(() => {
  const map = new Map<TaskStatus, Task[]>(columns.map((c) => [c.key, []]))
  for (const t of tasks.tasks) {
    const list = map.get(t.status)
    if (list) list.push(t)
  }
  return map
})

function assigneeName(id?: string): string {
  if (!id) return ''
  const role = id as keyof typeof ROLE_LABEL
  return ROLE_LABEL[role] ?? id
}

const priorityStyle = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'bg-zinc-500/10 text-zinc-500',
} as const
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="tasks.tasks.length === 0"
      class="card p-8 text-center text-sm text-muted-foreground"
    >
      目前沒有任務。按「開始示範」，技術長就會把專案拆解成任務。
    </p>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-6">
      <section
        v-for="col in columns"
        :key="col.key"
        class="rounded-lg border border-border bg-card/50 p-2"
        :aria-label="`${col.label}欄`"
      >
        <header class="mb-2 flex items-center justify-between px-1 py-1">
          <h3 class="text-xs font-semibold tracking-wide text-muted-foreground">
            {{ col.label }}
          </h3>
          <span class="rounded bg-muted px-1.5 font-mono text-xs tabular-nums">
            {{ byColumn.get(col.key)!.length }}
          </span>
        </header>

        <TransitionGroup name="task" tag="div" class="space-y-2">
          <article v-for="task in byColumn.get(col.key)" :key="task.id" class="task-card">
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-medium leading-snug">{{ task.title }}</h4>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                :class="priorityStyle[task.priority]"
              >
                {{ PRIORITY_LABEL[task.priority] }}優先
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ assigneeName(task.assigneeId) }}</p>
            <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">{{ task.id }}</p>
            <div class="mt-2">
              <ProgressBar :model-value="task.progress" show-value />
            </div>
            <ul v-if="task.dependencies.length" class="mt-2 space-y-0.5 text-xs">
              <li
                v-for="dep in task.dependencies"
                :key="dep"
                :class="
                  tasks.getById(dep)?.status === 'completed'
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-muted-foreground'
                "
              >
                {{ tasks.getById(dep)?.status === 'completed' ? '✓' : '○' }}
                {{ dep }} {{ tasks.getById(dep)?.title ?? '' }}
              </li>
            </ul>
          </article>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>
