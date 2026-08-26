import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { AgentContext } from '@/types/agentRuntime'
import type { Agent } from '@/types/agent'
import type { LLMProvider, LLMRequest, LLMResponse } from '@/types/llm'
import { RealAgentRuntime, MAX_RETRIES } from '@/engine/runtime/realAgentRuntime'
import { MockAgentRuntime } from '@/engine/runtime/mockAgentRuntime'
import { createAgentRuntime } from '@/engine/runtime'
import { parseLLMJson, validateAgentOutput } from '@/engine/runtime/schemaValidation'
import { toolRegistry, runToolCall } from '@/engine/tools/registry'
import { useTaskStore } from '@/stores/tasks'
import { resetToolCounters } from '@/engine/tools'

const testAgent: Agent = {
  id: 'cto',
  name: 'CTO',
  role: 'cto',
  avatar: '',
  status: 'working',
  department: 'Engineering',
  responsibilities: ['Plan architecture'],
}

function makeContext(): AgentContext {
  return {
    project: {
      name: 'E-commerce',
      description: 'Build an e-commerce website for handmade coffee',
      requirements: ['Google login', 'Product search'],
    },
    agent: testAgent,
    tasks: [],
    recentEvents: [],
    availableTools: [],
    previousResults: [],
  }
}

const goodJSON = JSON.stringify({
  status: 'success',
  message: 'Planned 2 implementation tasks.',
  tasks: [
    { title: 'Build product search', description: 'Search bar + filters', priority: 'high', assigneeRole: 'frontend' },
    { title: 'Set up database', priority: 'medium', assigneeRole: 'backend' },
  ],
  nextAction: 'Start frontend work',
})

/** Deterministic fake LLM — no network. */
function fakeProvider(response: () => string): LLMProvider & { calls: LLMRequest[] } {
  const calls: LLMRequest[] = []
  return {
    id: 'openai' as const,
    name: 'Fake',
    calls,
    async generate(request: LLMRequest): Promise<LLMResponse> {
      calls.push(request)
      return { content: response() }
    },
    async testConnection() {
      return { ok: true, message: 'ok' }
    },
  }
}

describe('parseLLMJson / validateAgentOutput (§24/§25)', () => {
  it('parses fenced JSON and validates a good output', () => {
    const raw = parseLLMJson('```json\n' + goodJSON + '\n```')
    const out = validateAgentOutput(raw)
    expect(out.status).toBe('success')
    expect(out.tasks).toHaveLength(2)
    expect(out.tasks[0]?.priority).toBe('high')
  })

  it('defaults invalid priority to medium instead of failing', () => {
    const raw = parseLLMJson('{"status":"success","message":"m","tasks":[{"title":"t","priority":"urgent"}]}')
    expect(validateAgentOutput(raw).tasks[0]?.priority).toBe('medium')
  })

  it('rejects bad status with validation error', () => {
    expect(() =>
      validateAgentOutput(parseLLMJson('{"status":"yolo","message":"m"}')),
    ).toThrowError(/status/)
  })

  it('rejects non-JSON prose', () => {
    expect(() => parseLLMJson('I think we should build it!')).toThrowError(/JSON/)
  })
})

describe('RealAgentRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetToolCounters()
  })

  it('creates real tasks through the tool layer from validated output', async () => {
    const provider = fakeProvider(() => goodJSON)
    const runtime = new RealAgentRuntime(provider, 'gpt-4o-mini')
    const result = await runtime.run(testAgent, makeContext())

    expect(result.status).toBe('success')
    expect(result.createdTasks).toHaveLength(2)
    expect(result.createdTasks?.[0]?.title).toBe('Build product search')
    // Tasks actually exist in the domain store (§19: runtime → store, not UI)
    const store = useTaskStore()
    expect(store.tasks.map((t) => t.title)).toContain('Build product search')
    expect(provider.calls[0]?.systemPrompt).toContain('Agent Role: CTO')
  })

  it('retries on invalid JSON then succeeds', async () => {
    let n = 0
    const provider = fakeProvider(() => (++n === 1 ? 'not json at all' : goodJSON))
    const runtime = new RealAgentRuntime(provider, 'gpt-4o-mini')
    const traces: unknown[] = []
    void traces
    const result = await runtime.run(testAgent, makeContext())
    expect(result.status).toBe('success')
    expect(provider.calls).toHaveLength(2)
  })

  it('gives up after MAX_RETRIES and returns failed result', async () => {
    const provider = fakeProvider(() => 'garbage')
    const runtime = new RealAgentRuntime(provider, 'gpt-4o-mini')
    const result = await runtime.run(testAgent, makeContext())
    expect(result.status).toBe('failed')
    expect(provider.calls).toHaveLength(MAX_RETRIES + 1)
  })

  it('does not retry authentication errors (§40)', async () => {
    const provider = fakeProvider(() => {
      throw Object.assign(new Error('bad key'), { type: 'authentication' })
    })
    const runtime = new RealAgentRuntime(provider, 'gpt-4o-mini')
    const result = await runtime.run(testAgent, makeContext())
    expect(result.status).toBe('failed')
    expect(provider.calls).toHaveLength(1)
  })
})

describe('MockAgentRuntime & factory (§17/§52)', () => {
  it('mock runtime is deterministic and offline', async () => {
    setActivePinia(createPinia())
    const runtime = new MockAgentRuntime()
    const r1 = await runtime.run(testAgent, makeContext())
    const r2 = await runtime.run(testAgent, makeContext())
    expect(r1.message).toBe(r2.message)
    expect(r1.status).toBe('success')
  })

  it('factory returns mock runtime in mock mode', async () => {
    setActivePinia(createPinia())
    const runtime = createAgentRuntime('mock')
    const result = await runtime.run(testAgent, makeContext())
    expect(result.message).toContain('[Mock]')
  })
})

describe('tool registry (§27/§28)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetToolCounters()
    useTaskStore().createTask({
      id: 'T-1',
      title: 'Existing task',
      description: '',
      priority: 'low',
      dependencies: [],
      status: 'pending',
    })
  })

  it('exposes exactly the six safe tools', () => {
    expect(toolRegistry().map((t) => t.name)).toEqual([
      'createTask',
      'updateTask',
      'getProjectState',
      'getTask',
      'searchKnowledge',
      'requestApproval',
    ])
  })

  it('runToolCall creates a task and validates required args', async () => {
    const call = await runToolCall({
      name: 'createTask',
      arguments: { title: 'New feature', priority: 'high', assigneeRole: 'frontend' },
    })
    expect(call.result).toMatchObject({ ok: true })
    const store = useTaskStore()
    expect(store.getById('RT-001')?.title).toBe('New feature')

    await expect(runToolCall({ name: 'createTask', arguments: {} })).rejects.toThrow(/title/)
    await expect(runToolCall({ name: 'nope', arguments: {} })).rejects.toThrow(/Unknown tool/)
  })

  it('updateTask mutates status; getTask reads back', async () => {
    await runToolCall({ name: 'updateTask', arguments: { taskId: 'T-1', status: 'completed' } })
    const task = (await runToolCall({ name: 'getTask', arguments: { taskId: 'T-1' } })).result as {
      status: string
    }
    expect(task.status).toBe('completed')
  })

  it('getProjectState and searchKnowledge read the store', async () => {
    const state = (await runToolCall({ name: 'getProjectState', arguments: {} })).result as {
      totalTasks: number
    }
    expect(state.totalTasks).toBe(1)
    const search = (await runToolCall({ name: 'searchKnowledge', arguments: { query: 'existing' } }))
      .result as { matches: unknown[] }
    expect(search.matches).toHaveLength(1)
  })
})
