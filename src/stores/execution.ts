import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExecutionEvent } from '@/types/execution'

const MAX_EVENTS = 200
let counter = 0

export const useExecutionStore = defineStore('execution', () => {
  const events = ref<ExecutionEvent[]>([])

  function push(event: Omit<ExecutionEvent, 'id' | 'timestamp'> & Partial<Pick<ExecutionEvent, 'timestamp'>>): ExecutionEvent {
    counter += 1
    const full: ExecutionEvent = {
      ...event,
      id: `event-${Date.now()}-${counter}`,
      timestamp: event.timestamp ?? Date.now(),
    }
    events.value.push(full)
    if (events.value.length > MAX_EVENTS) events.value.shift()
    return full
  }

  function reset(): void {
    events.value = []
  }

  function hydrate(saved: ExecutionEvent[]): void {
    events.value = saved.slice(-MAX_EVENTS)
  }

  return { events, push, reset, hydrate }
})
