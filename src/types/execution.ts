export type ExecutionEventType =
  | 'message'
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'tool_call'
  | 'approval_required'
  | 'approval_granted'
  | 'approval_rejected'
  | 'error'

/** 事件類型的中文標籤 */
export const EVENT_TYPE_LABEL: Record<ExecutionEventType, string> = {
  message: '訊息',
  task_created: '建立任務',
  task_started: '開始任務',
  task_completed: '完成任務',
  tool_call: '工具呼叫',
  approval_required: '需要核准',
  approval_granted: '已核准',
  approval_rejected: '已否決',
  error: '錯誤',
}

export interface ExecutionEvent {
  id: string
  timestamp: number
  agentId: string
  type: ExecutionEventType
  title: string
  description: string
  /** Spec §35 — which engine produced this event. */
  executionMode?: 'mock' | 'real'
  metadata?: Record<string, unknown>
}
