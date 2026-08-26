import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAIStore } from '@/stores/ai'

describe('useAIStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to mock mode with no key', () => {
    const ai = useAIStore()
    expect(ai.mode).toBe('mock')
    expect(ai.hasKey).toBe(false)
  })

  it('rejects switching to real without a key (§33)', () => {
    const ai = useAIStore()
    expect(ai.switchMode('real')).toBe(false)
    expect(ai.mode).toBe('mock')
  })

  it('switches to real once a key is present and shows notice', () => {
    const ai = useAIStore()
    ai.apiKey = 'sk-test'
    ai.model = 'gpt-4o-mini'
    expect(ai.switchMode('real')).toBe(true)
    expect(ai.mode).toBe('real')
    expect(ai.modeNotice).toContain('Real AI')
  })

  it('shows explicit mock notice on Real→Mock switch (§34)', () => {
    const ai = useAIStore()
    ai.apiKey = 'sk-test'
    ai.switchMode('real')
    expect(ai.switchMode('mock')).toBe(true)
    expect(ai.modeNotice).toContain('模擬')
  })

  it('clearing key drops back to mock immediately (§9)', () => {
    const ai = useAIStore()
    ai.apiKey = 'sk-test'
    ai.switchMode('real')
    ai.clearKey()
    expect(ai.hasKey).toBe(false)
    expect(ai.mode).toBe('mock')
  })

  it('buildProvider falls back to mock without key', async () => {
    const ai = useAIStore()
    const provider = ai.buildProvider()
    const res = await provider.generate({ model: 'x', messages: [{ role: 'user', content: 'hi' }] })
    expect(res.content).toContain('[Mock]')
  })

  it('never persists the API key to sessionStorage (§8)', () => {
    const ai = useAIStore()
    ai.apiKey = 'sk-super-secret'
    for (let i = 0; i < sessionStorage.length; i++) {
      const v = sessionStorage.getItem(sessionStorage.key(i) ?? '')
      expect(v).not.toContain('sk-super-secret')
    }
  })
})
