import { useTaskStore } from '@/stores/tasks'
import type { TaskPriority } from '@/types/task'

/**
 * Spec §26/§27 — safe, store-mediated tools only.
 * Tools never touch LLM providers or components directly (§54);
 * they read/mutate domain state via Pinia stores.
 */

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

let createdCounter = 0

export function resetToolCounters(): void {
  createdCounter = 0
}

/** createTask — spec §27. Ids are app-generated; LLM never controls ids. */
export const createTaskTool = {
  name: 'createTask',
  description: 'Create a new task in the project task board.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: PRIORITIES },
      assigneeRole: {
        type: 'string',
        enum: ['ceo', 'cto', 'product', 'designer', 'frontend', 'backend', 'qa'],
      },
    },
    required: ['title'],
  },

  async execute(input: unknown): Promise<unknown> {
    const args = input as { title?: string; description?: string; priority?: string; assigneeRole?: string }
    const title = asString(args.title).trim()
    if (!title) throw new Error('createTask requires a non-empty "title".')
    createdCounter += 1
    const id = `RT-${String(createdCounter).padStart(3, '0')}`
    const tasks = useTaskStore()
    tasks.createTask({
      id,
      title,
      description: asString(args.description),
      priority: PRIORITIES.includes(args.priority as TaskPriority)
        ? (args.priority as TaskPriority)
        : 'medium',
      assigneeId: args.assigneeRole,
      dependencies: [],
      status: 'pending',
    })
    return { ok: true, taskId: id }
  },
}

/** updateTask */
export const updateTaskTool = {
  name: 'updateTask',
  description: 'Update the status or progress of an existing task.',
  schema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'review', 'completed'] },
      progress: { type: 'number' },
    },
    required: ['taskId'],
  },

  async execute(input: unknown): Promise<unknown> {
    const args = input as { taskId?: string; status?: string; progress?: number }
    const tasks = useTaskStore()
    const id = asString(args.taskId)
    if (!tasks.getById(id)) throw new Error(`Task ${id} not found.`)
    if (args.status) tasks.setStatus(id, args.status as never)
    if (typeof args.progress === 'number') tasks.setProgress(id, Math.max(0, Math.min(100, args.progress)))
    return { ok: true, taskId: id }
  },
}

/** getProjectState */
export const getProjectStateTool = {
  name: 'getProjectState',
  description: 'Read the current project summary: all tasks with their statuses.',
  schema: { type: 'object', properties: {} },

  async execute(): Promise<unknown> {
    const tasks = useTaskStore()
    return {
      totalTasks: tasks.tasks.length,
      completed: tasks.completedCount,
      inProgress: tasks.inProgressCount,
      openBugs: tasks.bugs.filter((b) => !b.resolved).length,
      tasks: tasks.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, progress: t.progress })),
    }
  },
}

/** getTask */
export const getTaskTool = {
  name: 'getTask',
  description: 'Read one task by id.',
  schema: {
    type: 'object',
    properties: { taskId: { type: 'string' } },
    required: ['taskId'],
  },

  async execute(input: unknown): Promise<unknown> {
    const id = asString((input as { taskId?: string }).taskId)
    const task = useTaskStore().getById(id)
    if (!task) throw new Error(`Task ${id} not found.`)
    return task
  },
}

/** searchKnowledge — V2 stub over project data (no external network). */
export const searchKnowledgeTool = {
  name: 'searchKnowledge',
  description: 'Search project knowledge (task titles/descriptions) by keyword.',
  schema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },

  async execute(input: unknown): Promise<unknown> {
    const q = asString((input as { query?: string }).query).toLowerCase()
    const store = useTaskStore()
    const hits = store.tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    )
    return { query: q, matches: hits.map((t) => ({ id: t.id, title: t.title })) }
  },
}

/** requestApproval — surfaces Human Approval (§41); engine pauses on needs_approval. */
export const requestApprovalTool = {
  name: 'requestApproval',
  description: 'Request human approval for a high-risk or final action.',
  schema: {
    type: 'object',
    properties: { reason: { type: 'string' } },
    required: ['reason'],
  },

  async execute(input: unknown): Promise<unknown> {
    return { approvalRequested: true, reason: asString((input as { reason?: string }).reason) }
  },
}
