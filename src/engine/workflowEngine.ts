import type { AgentStatus } from '@/types/agent'
import { STATUS_LABEL } from '@/types/agent'

/** 合法的 Agent 狀態轉移（V1 模擬規則） */
export function canAgentTransition(from: AgentStatus, to: AgentStatus): boolean {
  if (from === to) return true
  const allowed: Record<AgentStatus, AgentStatus[]> = {
    idle: ['working', 'waiting', 'blocked', 'reviewing', 'completed'],
    working: ['idle', 'waiting', 'blocked', 'reviewing', 'completed'],
    waiting: ['working', 'blocked', 'idle'],
    blocked: ['waiting', 'working', 'idle'],
    reviewing: ['completed', 'working', 'idle'],
    completed: ['idle', 'working'],
  }
  return allowed[from].includes(to)
}

/**
 * 任務的所有依賴都完成時才可以開始。
 * Given：所有依賴任務已完成 → When：檢查可用性 → Then：任務變為可執行。
 */
export function isTaskAvailable(
  dependencies: string[],
  taskStatusOf: (id: string) => import('@/types/task').TaskStatus | undefined,
): boolean {
  return dependencies.every((id) => taskStatusOf(id) === 'completed')
}

export function statusLabel(status: AgentStatus): string {
  return STATUS_LABEL[status]
}
