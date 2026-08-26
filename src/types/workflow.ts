export interface WorkflowStep {
  /** 步驟唯一 ID */
  id: string
  /** 執行此步驟的 Agent */
  agentId: string
  /** Dashboard 顯示的階段名稱 */
  phase: string
  title: string
  description: string
  /** 1x 速度下的模擬時長（ms） */
  duration: number
  /** 此步驟開始時建立的任務 */
  createsTasks?: Array<{
    id: string
    title: string
    description: string
    priority: 'low' | 'medium' | 'high'
    assigneeId?: string
    dependencies: string[]
  }>
  /** 此步驟執行的任務 */
  taskId?: string
  /** 完成時把任務進度設為此值 */
  progressTo?: number
  /** 步驟進行中 Agent 的狀態 */
  statusDuring?: import('./agent').AgentStatus
  /** 需要人工核准才能繼續 */
  approvalRequired?: boolean
  /** 否決後回到此步驟 id 繼續 */
  rejectResumeStepId?: string
  /** 以工具呼叫事件呈現 */
  toolCalls?: string[]
}

export interface DemoScenario {
  id: string
  name: string
  requirement: string
  available: boolean
  steps: WorkflowStep[]
}
