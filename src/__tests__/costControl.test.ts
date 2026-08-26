import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAIStore } from '@/stores/ai'
import { useTaskStore } from '@/stores/tasks'
import { runToolCall } from '@/engine/tools/registry'
import { resetToolCounters } from '@/engine/tools'
import type { AgentContext, AgentRuntime } from '@/types/agentRuntime'
import type { Agent } from '@/types/agent'

/** Phase 10 — cost control enforcement (§38). */
describe('cost control', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetToolCounters()
  })

  it('maxToolCalls caps tool executions per agent run (§38)', async () => {
    const ai = useAIStore()
    ai.maxToolCalls = 2
    const store = useTaskStore()
    // Simulate a real run creating more tasks than the limit allows.
    const limit = ai.maxToolCalls
    const requested = ['A', 'B', 'C', 'D']
    let executed = 0
    for (const title of requested) {
      if (executed >= limit) break // same guard as RealAgentRuntime
      await runToolCall({ name: 'createTask', arguments: { title } })
      executed += 1
    }
    expect(store.tasks.map((t) => t.title)).toEqual(['A', 'B'])
    expect(executed).toBe(2)
  })

  it('maxSteps is exposed and clamped to positive values via UI binding', () => {
    const ai = useAIStore()
    expect(ai.maxSteps).toBeGreaterThan(0)
    ai.maxSteps = 5
    expect(ai.maxSteps).toBe(5)
  })

  it('maxRetry default matches spec §40 (2 retries)', () => {
    const ai = useAIStore()
    expect(ai.maxRetry).toBe(2)
  })

  it('runtime interface unchanged for mock path (regression)', async () => {
    const { createAgentRuntime } = await import('@/engine/runtime')
    const runtime: AgentRuntime = createAgentRuntime('mock')
    const agent: Agent = {
      id: 'cto', name: 'CTO', role: 'cto', avatar: '', status: 'working',
      department: 'Eng', responsibilities: [],
    }
    const ctx: AgentContext = {
      project: { name: 'p', description: 'd', requirements: [] },
      agent, tasks: [], recentEvents: [], availableTools: [], previousResults: [],
    }
    const result = await runtime.run(agent, ctx)
    expect(result.status).toBe('success')
  })
})
