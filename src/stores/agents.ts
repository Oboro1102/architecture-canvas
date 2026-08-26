import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AGENTS } from '@/data/agents'
import type { Agent, AgentStatus } from '@/types/agent'

export const useAgentStore = defineStore('agents', () => {
  const agents = ref<Agent[]>(AGENTS.map((a) => ({ ...a })))

  const activeCount = computed(
    () =>
      agents.value.filter((a) => a.status === 'working' || a.status === 'reviewing')
        .length,
  )

  function getById(id: string): Agent | undefined {
    return agents.value.find((a) => a.id === id)
  }

  function setStatus(id: string, status: AgentStatus): void {
    const agent = getById(id)
    if (agent) agent.status = status
  }

  function setCurrentTask(id: string, taskId?: string): void {
    const agent = getById(id)
    if (agent) agent.currentTaskId = taskId
  }

  function reset(): void {
    agents.value.forEach((a) => {
      a.status = 'idle'
      a.currentTaskId = undefined
    })
  }

  function hydrate(saved: Array<Pick<Agent, 'id' | 'status' | 'currentTaskId'>>): void {
    agents.value.forEach((a) => {
      const s = saved.find((x) => x.id === a.id)
      if (s) {
        a.status = s.status
        a.currentTaskId = s.currentTaskId
      }
    })
  }

  return { agents, activeCount, getById, setStatus, setCurrentTask, reset, hydrate }
})
