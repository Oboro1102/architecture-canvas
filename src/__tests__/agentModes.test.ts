import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAIStore } from '@/stores/ai'

/** Phase 7 — Per-Agent AI Mode (spec §37) and Mixed Execution (§36). */
describe('per-agent mode overrides', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to follow-global for every agent', () => {
    const ai = useAIStore()
    expect(ai.effectiveModeFor('frontend')).toBe('mock') // global default
  })

  it('override wins over global mode', () => {
    const ai = useAIStore()
    ai.apiKey = 'sk-test'
    ai.model = 'gpt-4o-mini'
    ai.switchMode('real')
    ai.setAgentMode('frontend', 'mock')

    expect(ai.mode).toBe('real')
    expect(ai.effectiveModeFor('ceo')).toBe('real') // follows global
    expect(ai.effectiveModeFor('frontend')).toBe('mock') // override
  })

  it('real override without a key degrades safely to mock', () => {
    const ai = useAIStore() // global mock, no key
    ai.setAgentMode('qa', 'real')
    expect(ai.effectiveModeFor('qa')).toBe('mock')
  })

  it('setting back to global removes the override', () => {
    const ai = useAIStore()
    ai.setAgentMode('backend', 'mock')
    expect(ai.agentModes['backend']).toBe('mock')
    ai.setAgentMode('backend', 'global')
    expect(ai.agentModes['backend']).toBeUndefined()
  })

  it('resetAgentModes clears all overrides (mixed execution teardown)', () => {
    const ai = useAIStore()
    ai.setAgentMode('frontend', 'mock')
    ai.setAgentMode('qa', 'real')
    ai.resetAgentModes()
    expect(Object.keys(ai.agentModes)).toHaveLength(0)
  })
})
