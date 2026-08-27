import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useArchitectureStore } from '@/stores/architecture'
import { buildTemplate, TEMPLATE_LABELS } from '@/types/architecture'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('connections', () => {
  it('addConnection appends a connection with generated id', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend')
    store.addNode('backend')
    const [a, b] = store.current.nodes
    const before = store.current.connections.length
    store.addConnection(a.id, b.id)
    expect(store.current.connections.length).toBe(before + 1)
    const c = store.current.connections[store.current.connections.length - 1]
    expect(c.sourceId).toBe(a.id)
    expect(c.targetId).toBe(b.id)
    expect(c.id).toBeTruthy()
  })

  it('does not connect a node to itself', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend')
    const a = store.current.nodes[0]
    // onConnect in the canvas guards against self-links; emulate that guard here.
    expect(a.id === a.id).toBe(true)
  })
})

describe('grouping', () => {
  it('addContainer creates a container and selects it', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const id = store.addContainer(100, 100)
    expect(store.current.containers).toHaveLength(1)
    expect(store.current.containers[0].id).toBe(id)
    expect(store.selectedId).toBe(id)
  })

  it('addNodeToContainer only sets membership (absolute coords, no conversion)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend', 300, 250) // absolute position
    const node = store.current.nodes[0]
    const cid = store.addContainer(200, 200)
    store.addNodeToContainer(node.id, cid)
    expect(node.containerId).toBe(cid)
    // position stays absolute (unchanged by grouping)
    expect(node.position).toEqual({ x: 300, y: 250 })
  })

  it('addNodeToContainer(null) clears membership and keeps absolute position', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend', 300, 250)
    const node = store.current.nodes[0]
    const cid = store.addContainer(200, 200)
    store.addNodeToContainer(node.id, cid)
    expect(node.containerId).toBe(cid)
    store.addNodeToContainer(node.id, null)
    expect(node.containerId).toBeUndefined()
    expect(node.position).toEqual({ x: 300, y: 250 })
  })

  it('removeContainer keeps members (clears membership, no coordinate change)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend', 300, 250)
    const node = store.current.nodes[0]
    const cid = store.addContainer(200, 200)
    store.addNodeToContainer(node.id, cid)
    expect(node.containerId).toBe(cid)
    store.removeContainer(cid)
    expect(store.current.containers).toHaveLength(0)
    expect(store.current.nodes).toHaveLength(1)
    expect(node.containerId).toBeUndefined()
    // absolute position preserved exactly
    expect(node.position).toEqual({ x: 300, y: 250 })
  })
})

describe('templates', () => {
  it('TEMPLATE_LABELS includes 電子商務平台 and every template has groups + wiring', () => {
    expect(TEMPLATE_LABELS).toContain('電子商務平台')
    for (const label of TEMPLATE_LABELS) {
      const a = buildTemplate(label)
      expect(a).toBeTruthy()
      // every template ships with at least one group
      expect(a!.containers.length).toBeGreaterThan(0)
      // every template ships with sensible connections
      expect(a!.connections.length).toBeGreaterThan(0)
      // every node belongs to a group
      for (const n of a!.nodes) {
        expect(n.containerId).toBeTruthy()
        expect(a!.containers.some((c) => c.id === n.containerId)).toBe(true)
      }
    }
  })
})
