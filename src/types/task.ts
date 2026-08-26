export type TaskStatus =
  | 'backlog'
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'completed'

export type TaskPriority = 'low' | 'medium' | 'high'

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: '待辦清單',
  pending: '等待中',
  in_progress: '進行中',
  review: '審查中',
  blocked: '已阻塞',
  completed: '已完成',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assigneeId?: string
  dependencies: string[]
  priority: TaskPriority
  progress: number
  createdAt: number
  completedAt?: number
}

export interface Bug {
  id: string
  title: string
  description: string
  foundByTaskId: string
  fixedByAgentId?: string
  resolved: boolean
}
