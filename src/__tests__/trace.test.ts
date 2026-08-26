import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTraceStore } from '@/stores/trace'
import type { RealRunTrace } from '@/engine/runtime/realAgentRuntime'

const baseTrace: RealRunTrace = {
  agentId: 'cto',
  providerId: 'openai',
  model: 'gpt-4o-mini',
  durationMs: 4200,
  attempt: 0,
  usage: { inputTokens: 1240, outputTokens: 420, totalTokens: 1660 },
  finishReason: 'stop',
  promptVersion: 'agent-planner@1.0',
  toolCalls: ['getProjectState', 'createTask'],
  status: 'success',
}

describe('trace store (Phase 8 / §29)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('records and queries traces per agent', () => {
    const trace = useTraceStore()
    trace.record(baseTrace)
    trace.record({ ...baseTrace, agentId: 'qa' })
    expect(trace.traces).toHaveLength(2)
    expect(trace.forAgent('cto')).toHaveLength(1)
    expect(trace.lastForAgent('qa')?.model).toBe('gpt-4o-mini')
  })

  it('caps stored traces at 500', () => {
    const trace = useTraceStore()
    for (let i = 0; i < 510; i++) {
      trace.record({ ...baseTrace, durationMs: i })
    }
    expect(trace.traces).toHaveLength(500)
  })

  it('never stores api key fields even if present on the source object', () => {
    const trace = useTraceStore()
    // Simulate an accidental extra field — the record shape must not carry secrets.
    const leaked = JSON.parse(JSON.stringify(baseTrace)) as RealRunTrace & { apiKey?: string }
    leaked.apiKey = 'sk-secret'
    trace.record(leaked)
    expect(JSON.stringify(trace.traces)).not.toContain('sk-secret')
  })
})
