import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCompanyStore } from '@/stores/company'
import { getEngine } from '@/engine/scenarioEngine'

describe('probe15 - pause at 1x', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('pause after 300ms real time', async () => {
    const company = useCompanyStore()
    company.setSpeed(1)
    getEngine().start('ecommerce')
    console.log('after start:', company.runState)
    await new Promise((r) => setTimeout(r, 300))
    console.log('before pause:', company.runState)
    getEngine().pause()
    console.log('after pause:', company.runState)
    expect(true).toBe(true)
  })
})
