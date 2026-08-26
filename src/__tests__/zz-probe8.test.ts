import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCompanyStore } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { ScenarioEngine } from '@/engine/scenarioEngine'

describe('probe8 - manual ticks', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('call tick manually', async () => {
    const company = useCompanyStore()
    const tasks = useTaskStore()
    company.setSpeed(64)
    const eng = new ScenarioEngine() as unknown as {
      beginStep: (i: number) => void
      tick: () => void
      stepIndex: number
    }
    eng.beginStep(0)
    console.log('step0 idx:', eng.stepIndex)
    for (let i = 0; i < 200 && tasks.tasks.length < 8; i++) {
      eng.tick()
    }
    console.log('tasks created:', tasks.tasks.map((t) => t.id).join(','))
    expect(true).toBe(true)
  })
})
