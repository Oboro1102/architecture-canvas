import type { Project } from './project'
import type { Agent } from './agent'
import type { Task } from './task'

/** Spec §26 — Agent tool contract (safe, store-mediated tools only). */
export interface AgentTool {
  name: string
  description: string
  /** JSON Schema describing the execute() input. */
  schema: unknown

  execute(input: unknown): Promise<unknown>
}

export type AgentToolCall = {
  name: string
  arguments: Record<string, unknown>
  result: unknown
}

/** Spec §20 */
export interface AgentContext {
  project: Project
  agent: Agent
  tasks: Task[]
  recentEvents: Array<{ agentId: string; title: string; description: string }>
  availableTools: AgentTool[]
  previousResults: AgentResult[]
}

export type AgentResultStatus = 'success' | 'failed' | 'blocked' | 'needs_approval'

/** Spec §21 */
export interface AgentResult {
  status: AgentResultStatus
  message: string
  createdTasks?: Task[]
  toolCalls?: AgentToolCall[]
  nextAction?: string
}

/** Spec §16 */
export interface AgentRuntime {
  run(agent: Agent, context: AgentContext): Promise<AgentResult>
}
