import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '@/stores/agents'
import { useExecutionStore } from '@/stores/execution'
import { useCompanyStore } from '@/stores/company'
import { SCENARIOS } from '@/data/scenarios'
import type { AgentStatus } from '@/types/agent'
import { getEngine } from '@/engine/scenarioEngine'

/**
 * 引擎以 interval tick 驅動；在 jsdom 裡 timer 是真的，
 * 我們直接用真實等待 + 高速度（64x）讓流程快速跑完。
 */
async function waitFor(
  cond: () => boolean,
  timeoutMs = 15000,
): Promise<boolean> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) return false
    await new Promise((r) => setTimeout(r, 25))
  }
  return true
}

describe('示範情境資料', () => {
  it('預設情境存在且可用，步驟數超過 10', () => {
    const s = SCENARIOS.find((x) => x.id === 'ecommerce')
    expect(s?.available).toBe(true)
    expect(s?.steps.length).toBeGreaterThan(10)
  })
})

describe('Mock Agent Engine', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('完整流程會停在「等待核准」，核准後完成', async () => {
    const company = useCompanyStore()
    const exec = useExecutionStore()
    company.setSpeed(64)

    getEngine().start('ecommerce')
    const halted = await waitFor(() => company.runState === 'awaiting_approval')
    expect(halted).toBe(true)
    expect(exec.events.some((e) => e.type === 'approval_required')).toBe(true)

    // 核准前：任務與 Bug 狀態正確
    const tasks = (await import('@/stores/tasks')).useTaskStore()
    expect(tasks.bugs.every((b) => b.resolved)).toBe(true)
    expect(tasks.getById('TASK-007')?.status).toBe('completed')

    getEngine().approve()
    expect(company.runState).toBe('completed')
    expect(company.phase).toBe('完成')
  })

  it('否決後流程回到除錯修復階段並再次到達核准點', async () => {
    const company = useCompanyStore()
    const exec = useExecutionStore()
    company.setSpeed(64)

    getEngine().start('ecommerce')
    await waitFor(() => company.runState === 'awaiting_approval')

    getEngine().reject()
    expect(company.runState).toBe('running')

    const second = await waitFor(() => company.runState === 'awaiting_approval')
    expect(second).toBe(true)
    expect(exec.events.filter((e) => e.type === 'approval_required').length).toBe(2)
  }, 30000)

  it('暫停 / 繼續正常運作', async () => {
    const company = useCompanyStore()
    company.setSpeed(1) // 慢速方便測暫停

    getEngine().start('ecommerce')
    await new Promise((r) => setTimeout(r, 300))

    getEngine().pause()
    expect(company.runState).toBe('paused')
    const eventsAtPause = useExecutionStore().events.length
    await new Promise((r) => setTimeout(r, 400))
    expect(useExecutionStore().events.length).toBe(eventsAtPause) // 暫停中不推進

    getEngine().resume()
    expect(company.runState).toBe('running')

    // 收尾：重設清空一切
    getEngine().reset()
    expect(company.runState).toBe('idle')
    expect(useExecutionStore().events.length).toBe(0)
  })

  it('重設後 Agent 全部回 idle', async () => {
    const company = useCompanyStore()
    const agents = useAgentStore()
    company.setSpeed(64)
    getEngine().start('ecommerce')
    await new Promise((r) => setTimeout(r, 200))
    getEngine().reset()
    expect(agents.agents.every((a) => a.status === 'idle')).toBe(true)
    expect(company.projectName).toBe('')
  })
})

describe('Agent Store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('hydrate 可還原儲存的狀態', () => {
    const agents = useAgentStore()
    agents.hydrate([{ id: 'qa', status: 'working' as AgentStatus }])
    expect(agents.getById('qa')?.status).toBe('working')
  })
})
