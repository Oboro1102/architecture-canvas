import { LLMError } from '@/types/llm'
import type { AgentResultStatus } from '@/types/agentRuntime'

/**
 * Spec §24/§25 — LLM JSON is NEVER trusted directly.
 * Parse → validate schema → valid ? continue : retry/error.
 */

const STATUSES: AgentResultStatus[] = ['success', 'failed', 'blocked', 'needs_approval']
const PRIORITIES = ['high', 'medium', 'low']
const ROLES = ['ceo', 'cto', 'product', 'designer', 'frontend', 'backend', 'qa']

export interface RawAgentOutput {
  status: AgentResultStatus
  message: string
  tasks: Array<{
    title: string
    description: string
    priority: TaskPriorityLike
    assigneeRole?: string
  }>
  nextAction?: string
}

type TaskPriorityLike = 'high' | 'medium' | 'low'

/** Strip markdown fences / surrounding prose, then parse. Throws invalid_response on failure. */
export function parseLLMJson(content: string): unknown {
  let text = content.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = (fence[1] ?? '').trim()
  // Fall back to first { … last } slice.
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new LLMError('invalid_response', 'Response did not contain a JSON object.')
  }
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new LLMError('invalid_response', 'Response JSON could not be parsed.')
  }
}

/** Schema validation — throws validation error with a human-readable reason. */
export function validateAgentOutput(raw: unknown): RawAgentOutput {
  if (typeof raw !== 'object' || raw === null) {
    throw new LLMError('validation', 'Output is not an object.')
  }
  const obj = raw as Record<string, unknown>

  if (!STATUSES.includes(obj.status as AgentResultStatus)) {
    throw new LLMError('validation', `"status" must be one of ${STATUSES.join('|')}.`)
  }
  if (typeof obj.message !== 'string' || !obj.message.trim()) {
    throw new LLMError('validation', '"message" must be a non-empty string.')
  }

  const tasksRaw = obj.tasks ?? []
  if (!Array.isArray(tasksRaw)) {
    throw new LLMError('validation', '"tasks" must be an array.')
  }
  const tasks = tasksRaw.map((t, i) => {
    if (typeof t !== 'object' || t === null) {
      throw new LLMError('validation', `tasks[${i}] is not an object.`)
    }
    const task = t as Record<string, unknown>
    if (typeof task.title !== 'string' || !task.title.trim()) {
      throw new LLMError('validation', `tasks[${i}].title must be a non-empty string.`)
    }
    const priority =
      typeof task.priority === 'string' && PRIORITIES.includes(task.priority)
        ? task.priority
        : 'medium'
    const role =
      typeof task.assigneeRole === 'string' && ROLES.includes(task.assigneeRole)
        ? task.assigneeRole
        : undefined
    return {
      title: task.title,
      description: typeof task.description === 'string' ? task.description : '',
      priority: priority as TaskPriorityLike,
      ...(role ? { assigneeRole: role } : {}),
    }
  })

  return {
    status: obj.status as AgentResultStatus,
    message: obj.message,
    tasks,
    nextAction: typeof obj.nextAction === 'string' ? obj.nextAction : undefined,
  }
}
