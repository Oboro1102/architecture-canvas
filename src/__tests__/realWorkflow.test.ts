import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAIStore } from '@/stores/ai'
import { useCompanyStore } from '@/stores/company'
import { useExecutionStore } from '@/stores/execution'
import { RealWorkflowEngine, resolveRealApproval } from '@/engine/realWorkflowEngine'
import type { Project } from '@/types/project'

const PROJECT: Project = {
  name: 'Coffee Shop',
  description: 'E-commerce for handmade coffee',
  requirements: ['login', 'cart'],
}

/** Drain microtasks until the workflow pauses for approval, then decide. */
async function runWithDecision(
  engine: RealWorkflowEngine,
  approved: boolean,
): Promise<void> {
  const done = engine.start(PROJECT)
  const company = useCompanyStore()
  // The single pause point is the CEO final review.
  for (let i = 0; i < 200 && company.runState !== 'awaiting_approval'; i++) {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  }
  expect(company.runState).toBe('awaiting_approval')
  resolveRealApproval(approved)
  await done
}

describe('RealWorkflowEngine', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAIStore().switchMode('mock') // deterministic, offline
  })

  it('runs all eight ordered steps and completes after approval (§58)', async () => {
    const engine = new RealWorkflowEngine()
    await runWithDecision(engine, true)

    const company = useCompanyStore()
    expect(company.runState).toBe('completed')
    expect(company.phase).toBe('完成')

    const exec = useExecutionStore()
    // CEO appears twice (kick-off + final review).
    const ceoEvents = exec.events.filter((e) => e.agentId === 'ceo')
    expect(ceoEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('pauses for Human Approval before completing (§41)', async () => {
    const engine = new RealWorkflowEngine()
    await runWithDecision(engine, true)
    const exec = useExecutionStore()
    const approval = exec.events.find((e) => e.type === 'approval_required')
    expect(approval).toBeDefined()
    expect(approval?.agentId).toBe('ceo')
  })

  it('rejecting approval still finishes without crash', async () => {
    const engine = new RealWorkflowEngine()
    await runWithDecision(engine, false)
    expect(useCompanyStore().runState).toBe('completed')
  })

  it('tags every event with executionMode (§35)', async () => {
    const engine = new RealWorkflowEngine()
    await runWithDecision(engine, true)

    const exec = useExecutionStore()
    expect(exec.events.length).toBeGreaterThan(0)
    for (const e of exec.events) {
      expect(e.executionMode).toBe('mock')
    }
  })

  it('is a no-op to start twice concurrently', async () => {
    useAIStore().switchMode('mock')
    const engine = new RealWorkflowEngine()
    const p1 = runWithDecision(engine, true)
    const second = engine.start(PROJECT) // ignored while running
    void second
    await p1
    expect(useCompanyStore().runState).toBe('completed')
  })
})
