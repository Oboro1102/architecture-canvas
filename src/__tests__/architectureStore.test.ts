import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useArchitectureStore } from '@/stores/architecture'
import { NODE_GROUPS, NODE_LABELS, type NodeType } from '@/types/architecture'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useArchitectureStore', () => {
  it('starts with a demo architecture that has nodes', () => {
    const store = useArchitectureStore()
    expect(store.current.nodes.length).toBeGreaterThan(0)
    expect(store.current.connections.length).toBeGreaterThan(0)
  })

  it('addNode appends a node and selects it', () => {
    const store = useArchitectureStore()
    const before = store.current.nodes.length
    store.addNode('database')
    expect(store.current.nodes.length).toBe(before + 1)
    const added = store.current.nodes[store.current.nodes.length - 1]
    expect(added.type).toBe('database')
    expect(added.name).toBe('Database')
    expect(store.selectedId).toBe(added.id)
  })

  it('newArchitecture resets to a blank architecture', () => {
    const store = useArchitectureStore()
    store.newArchitecture('My Arch')
    expect(store.current.name).toBe('My Arch')
    expect(store.current.nodes).toHaveLength(0)
    expect(store.current.connections).toHaveLength(0)
    expect(store.canUndo).toBe(true)
  })

  it('undo / redo restores previous state', () => {
    const store = useArchitectureStore()
    const initialCount = store.current.nodes.length
    store.addNode('cache')
    expect(store.current.nodes.length).toBe(initialCount + 1)
    store.undo()
    expect(store.current.nodes.length).toBe(initialCount)
    store.redo()
    expect(store.current.nodes.length).toBe(initialCount + 1)
  })

  it('removeSelected deletes the selected node', () => {
    const store = useArchitectureStore()
    store.addNode('storage')
    const id = store.selectedId
    expect(id).toBeTruthy()
    store.removeSelected()
    expect(store.current.nodes.find((n) => n.id === id)).toBeUndefined()
    expect(store.selectedId).toBeNull()
  })

  it('zoomIn / zoomOut clamps within bounds', () => {
    const store = useArchitectureStore()
    const base = store.current.viewport.zoom
    store.zoomIn()
    expect(store.current.viewport.zoom).toBeGreaterThan(base)
    store.zoomOut()
    expect(store.current.viewport.zoom).toBeCloseTo(base)
    // spam zoom-out should not go below 0.3
    for (let i = 0; i < 20; i++) store.zoomOut()
    expect(store.current.viewport.zoom).toBeGreaterThanOrEqual(0.3)
  })

  it('NODE_GROUPS covers the same types referenced by the canvas', () => {
    // every group type should have a label
    const allTypes: NodeType[] = NODE_GROUPS.flatMap((g) => g.types)
    for (const t of allTypes) {
      expect(NODE_LABELS[t]).toBeTruthy()
    }
  })
})
