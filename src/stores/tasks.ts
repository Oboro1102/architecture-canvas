import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskStatus, Bug } from '@/types/task'
import { isTaskAvailable } from '@/engine/workflowEngine'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const bugs = ref<Bug[]>([])

  const completedCount = computed(
    () => tasks.value.filter((t) => t.status === 'completed').length,
  )
  const inProgressCount = computed(
    () => tasks.value.filter((t) => t.status === 'in_progress').length,
  )
  const blockedCount = computed(
    () => tasks.value.filter((t) => t.status === 'blocked').length,
  )
  const overallProgress = computed(() => {
    if (tasks.value.length === 0) return 0
    const sum = tasks.value.reduce((acc, t) => acc + t.progress, 0)
    return Math.round(sum / tasks.value.length)
  })

  function getById(id: string): Task | undefined {
    return tasks.value.find((t) => t.id === id)
  }

  function createTask(
    task: Omit<Task, 'status' | 'progress' | 'createdAt'> & Partial<Pick<Task, 'status'>>,
  ): void {
    if (getById(task.id)) return // 冪等：否決後重跑步驟不會重複建立
    tasks.value.push({
      ...task,
      status: task.status ?? 'backlog',
      progress: 0,
      createdAt: Date.now(),
    })
  }

  function setStatus(id: string, status: TaskStatus): void {
    const task = getById(id)
    if (!task) return
    task.status = status
    if (status === 'completed') {
      task.progress = 100
      task.completedAt = Date.now()
    }
  }

  function setProgress(id: string, progress: number): void {
    const task = getById(id)
    if (!task) return
    task.progress = Math.min(100, Math.max(0, Math.round(progress)))
    if (task.progress >= 100 && task.status !== 'blocked') {
      task.status = 'completed'
      task.completedAt = Date.now()
    }
  }

  /** 依賴全部完成的任務自動解鎖為進行中 */
  function refreshUnlocks(): string[] {
    const unlocked: string[] = []
    for (const t of tasks.value) {
      if (
        (t.status === 'pending' || t.status === 'backlog') &&
        isTaskAvailable(t.dependencies, (id) => getById(id)?.status)
      ) {
        t.status = 'in_progress'
        unlocked.push(t.id)
      }
    }
    return unlocked
  }

  function addBug(bug: Bug): void {
    bugs.value.push({ ...bug, resolved: false })
  }

  function resolveBugs(ids: string[], fixedByAgentId: string): void {
    bugs.value.forEach((b) => {
      if (ids.includes(b.id)) {
        b.resolved = true
        b.fixedByAgentId = fixedByAgentId
      }
    })
  }

  function reset(): void {
    tasks.value = []
    bugs.value = []
  }

  function hydrate(savedTasks: Task[], savedBugs: Bug[]): void {
    tasks.value = savedTasks
    bugs.value = savedBugs
  }

  return {
    tasks,
    bugs,
    completedCount,
    inProgressCount,
    blockedCount,
    overallProgress,
    getById,
    createTask,
    setStatus,
    setProgress,
    refreshUnlocks,
    addBug,
    resolveBugs,
    reset,
    hydrate,
  }
})
