import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluationStore } from '@/stores/evaluation'
import type { RealRunTrace } from '@/engine/runtime/realAgentRuntime'

function trace(over: Partial<RealRunTrace> = {}): RealRunTrace {
  return {
    agentId: 'cto',
    providerId: 'openai',
    model: 'gpt-4o-mini',
    durationMs: 2000,
    attempt: 0,
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    finishReason: 'stop',
    promptVersion: 'agent-planner@1.0',
    toolCalls: [],
    status: 'success',
    ...over,
  }
}

/** Phase 9 — §55/§56 evaluation math. No fabricated numbers. */
describe('evaluation store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('reports nulls when there are no traces (unavailable, not fake)', () => {
    const ev = useEvaluationStore()
    expect(ev.total).toBe(0)
    expect(ev.successRate).toBeNull()
    expect(ev.totalTokens).toBeNull()
  })

  it('computes success rate and averages', () => {
    const ev = useEvaluationStore()
    ev.syncFrom([
      trace({ durationMs: 1000 }),
      trace({ durationMs: 3000, status: 'failed', attempt: 2 }),
      trace({ durationMs: 2000, toolCalls: ['a', 'b'] }),
    ])
    expect(ev.total).toBe(3)
    expect(ev.successful).toBe(2)
    expect(ev.failed).toBe(1)
    expect(ev.successRate).toBe(67)
    expect(ev.averageDurationSec).toBeCloseTo(2.0)
    expect(ev.totalRetries).toBe(2)
  })

  it('token total only counts runs that reported usage (§56)', () => {
    const ev = useEvaluationStore()
    ev.syncFrom([
      trace({ usage: { totalTokens: 100 } }),
      trace({ usage: undefined }), // provider didn't report → excluded
    ])
    expect(ev.totalTokens).toBe(100) // not fabricated average
  })
})
