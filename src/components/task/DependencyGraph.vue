<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { ROLE_LABEL } from '@/types/agent'
import type { Task } from '@/types/task'

const tasks = useTaskStore()

/**
 * 簡單的分層依賴圖：以最長依賴鏈計算層數，
 * 每層一列、節點按 ID 排序，層與層之間畫箭頭。
 */
const layers = computed<Task[][]>(() => {
  const all = tasks.tasks
  if (all.length === 0) return []
  const depth = (t: Task, seen = new Set<string>()): number => {
    if (t.dependencies.length === 0 || seen.has(t.id)) return 0
    seen.add(t.id)
    return (
      1 +
      Math.max(
        0,
        ...t.dependencies
          .map((d) => tasks.getById(d))
          .filter((x): x is Task => !!x)
          .map((d) => depth(d, seen)),
      )
    )
  }
  const maxDepth = Math.max(...all.map((t) => depth(t)))
  const result: Task[][] = Array.from({ length: maxDepth + 1 }, () => [])
  for (const t of [...all].sort((a, b) => a.id.localeCompare(b.id))) {
    result[depth(t)]!.push(t)
  }
  return result
})

function statusColor(t: Task | undefined): string {
  if (!t) return '#71717a'
  switch (t.status) {
    case 'completed':
      return '#14b8a6'
    case 'in_progress':
      return '#10b981'
    case 'blocked':
      return '#ef4444'
    case 'review':
      return '#3b82f6'
    default:
      return '#a1a1aa'
  }
}

const roleOf: Record<string, keyof typeof ROLE_LABEL> = {
  ceo: 'ceo',
  cto: 'cto',
  product: 'product',
  designer: 'designer',
  frontend: 'frontend',
  backend: 'backend',
  qa: 'qa',
}
</script>

<template>
  <div class="card p-5" aria-label="任務依賴關係圖">
    <h3 class="mb-4 text-sm font-semibold">任務依賴關係</h3>

    <p v-if="layers.length === 0" class="text-sm text-muted-foreground">
      流程建立任務後，依賴關係圖會顯示在這裡。
    </p>

    <div v-else class="overflow-x-auto">
      <div class="min-w-max space-y-2">
        <template v-for="(layer, li) in layers" :key="li">
          <!-- 層間箭頭 -->
          <div v-if="li > 0" class="flex justify-center gap-8" aria-hidden="true">
            <span v-for="_ in layer" :key="`arr-${li}-${_}`" class="text-muted-foreground/50">
              ↓
            </span>
          </div>
          <div class="flex flex-wrap items-stretch justify-center gap-2">
            <div
              v-for="task in layer"
              :key="task.id"
              class="rounded-md border bg-card px-3 py-1.5 text-xs"
              :style="{
                borderColor: statusColor(task),
                borderWidth: task.status === 'completed' ? '1px' : '2px',
              }"
            >
              <span class="font-mono text-[10px] text-muted-foreground">{{ task.id }}</span>
              <span class="ml-1.5 font-medium">{{ task.title }}</span>
              <span v-if="task.assigneeId && roleOf[task.assigneeId]" class="ml-1 text-[10px] text-muted-foreground">
                （{{ ROLE_LABEL[roleOf[task.assigneeId]!] }}）
              </span>
              <span v-if="task.status === 'completed'" aria-label="已完成">✓</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <ul class="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
      <li><span class="mr-1 inline-block size-2 rounded-full bg-teal-500" aria-hidden="true" />已完成</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true" />進行中</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-red-500" aria-hidden="true" />已阻塞</li>
      <li><span class="mr-1 inline-block size-2 rounded-full bg-zinc-400" aria-hidden="true" />等待中</li>
    </ul>
  </div>
</template>
