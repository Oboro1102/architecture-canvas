/**
 * Canvas 視覺層的 WorkflowEvent 型別（spec §29–30）。
 *
 * Mock 與 Real workflow 未來共用此事件介面——Canvas 引擎只消費事件，
 * 不認得任何 LLM provider / HTTP / API key。
 */

export type WorkflowEventType =
  | 'task-start'
  | 'agent-start'
  | 'tool-call'
  | 'data-flow'
  | 'agent-complete'
  | 'task-complete'
  | 'error'

export interface WorkflowEvent {
  id: string
  type: WorkflowEventType
  sourceId: string
  targetId?: string
  timestamp: number
  payload?: unknown
}
