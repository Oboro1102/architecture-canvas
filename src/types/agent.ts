export type AgentRole =
  | 'ceo'
  | 'cto'
  | 'product'
  | 'designer'
  | 'frontend'
  | 'backend'
  | 'qa'

/** 各角色的中文職稱 */
export const ROLE_LABEL: Record<AgentRole, string> = {
  ceo: '執行長',
  cto: '技術長',
  product: '產品經理',
  designer: 'UX 設計師',
  frontend: '前端工程師',
  backend: '後端工程師',
  qa: 'QA 測試工程師',
}

export const ROLE_LABEL_EN: Record<AgentRole, string> = {
  ceo: 'CEO',
  cto: 'CTO',
  product: 'Product Manager',
  designer: 'UX Designer',
  frontend: 'Frontend Engineer',
  backend: 'Backend Engineer',
  qa: 'QA Engineer',
}

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'waiting'
  | 'blocked'
  | 'reviewing'
  | 'completed'

/** 狀態的中文標籤 */
export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: '閒置',
  working: '工作中',
  waiting: '等待中',
  blocked: '已阻塞',
  reviewing: '審查中',
  completed: '已完成',
}

export interface Agent {
  id: string
  name: string
  role: AgentRole
  avatar: string
  status: AgentStatus
  currentTaskId?: string
  department: string
  responsibilities: string[]
}
