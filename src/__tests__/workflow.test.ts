import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
import { isTaskAvailable, canAgentTransition } from '@/engine/workflowEngine'

describe('任務依賴', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Given 依賴已完成 When 檢查可用性 Then 任務變為可執行', () => {
    const store = useTaskStore()
    store.createTask({ id: 'T1', title: '設計', description: '', priority: 'high' })
    store.createTask({
      id: 'T2',
      title: '實作',
      description: '',
      priority: 'medium',
      dependencies: ['T1'],
    })
    store.setStatus('T1', 'completed')
    expect(isTaskAvailable(['T1'], (id) => store.getById(id)?.status)).toBe(true)
  })

  it('依賴未完成時任務不可開始', () => {
    const store = useTaskStore()
    store.createTask({ id: 'A', title: 'A', description: '', priority: 'low' })
    expect(isTaskAvailable(['A'], (id) => store.getById(id)?.status)).toBe(false)
  })

  it('refreshUnlocks：依賴完成後 pending 任務自動解鎖', () => {
    const store = useTaskStore()
    store.createTask({ id: 'D1', title: 'D1', description: '', priority: 'low' })
    store.createTask({
      id: 'D2',
      title: 'D2',
      description: '',
      priority: 'low',
      dependencies: ['D1'],
      status: 'pending',
    })
    store.setStatus('D1', 'completed')
    const unlocked = store.refreshUnlocks()
    expect(unlocked).toContain('D2')
    expect(store.getById('D2')?.status).toBe('in_progress')
  })
})

describe('Agent 狀態轉移', () => {
  it('允許 idle→working 與 working→blocked', () => {
    expect(canAgentTransition('idle', 'working')).toBe(true)
    expect(canAgentTransition('working', 'blocked')).toBe(true)
  })

  it('拒絕不合法的轉移（如 completed→reviewing）', () => {
    expect(canAgentTransition('completed', 'reviewing')).toBe(false)
    expect(canAgentTransition('idle', 'idle')).toBe(true)
  })
})

describe('執行事件', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('事件會累積且 reset 會清空', () => {
    const exec = useExecutionStore()
    exec.push({ agentId: 'ceo', type: 'message', title: 't', description: 'd' })
    expect(exec.events.length).toBe(1)
    exec.reset()
    expect(exec.events.length).toBe(0)
  })
})
