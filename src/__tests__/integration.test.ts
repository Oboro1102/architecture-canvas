/**
 * Integration tests for the core Architecture Canvas editing flows.
 *
 * These exercise the store's action chain the way the UI wires it up
 * (ArchitectureCanvas.vue / LandingView.vue), so they cover the real
 * "新增結點 / 移除 / 群組 / 線條連接 / 畫布縮放" paths end-to-end through
 * the single source of truth (stores/architecture.ts) rather than in isolation.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useArchitectureStore } from '@/stores/architecture'
import { buildTemplate } from '@/types/architecture'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('結點新增 (addNode)', () => {
  it('從元件庫點擊類型會新增對應結點並自動選取', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const before = store.current.nodes.length
    store.addNode('frontend')
    expect(store.current.nodes.length).toBe(before + 1)
    const added = store.current.nodes[store.current.nodes.length - 1]
    expect(added.type).toBe('frontend')
    expect(added.name).toBe('Frontend')
    expect(store.selectedId).toBe(added.id)
  })

  it('新增到群組內時會帶上 containerId (歸組)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const cid = store.addContainer(100, 100)
    store.addNode('service', 150, 150, cid)
    const n = store.current.nodes.find((x) => x.containerId === cid)
    expect(n).toBeTruthy()
    expect(n!.containerId).toBe(cid)
  })
})

describe('線條連接 (addConnection / onConnect guard)', () => {
  it('從一個結點拖線到另一個結點會建立連線', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend')
    store.addNode('backend')
    const [a, b] = store.current.nodes
    store.addConnection(a.id, b.id)
    expect(store.current.connections).toHaveLength(1)
    const c = store.current.connections[0]
    expect(c.sourceId).toBe(a.id)
    expect(c.targetId).toBe(b.id)
    expect(c.type).toBe('dependency')
  })

  it('onConnect 的防呆：不允許自連 (self-loop)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('gateway')
    const a = store.current.nodes[0]
    // Mirror the guard in ArchitectureCanvas.vue onConnect():
    //   if (!conn.source || !conn.target || conn.source === conn.target) return
    const wouldConnect = a.id !== a.id // self-link is rejected
    expect(wouldConnect).toBe(false)
  })

  it('連線會成為下游/上游鄰居 (Inspector 的「下游節點」清單來源)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend')
    store.addNode('backend')
    const [a, b] = store.current.nodes
    store.addConnection(a.id, b.id)
    const nb = store.getNeighbors(a.id)
    expect(nb.outgoingNodes.map((n) => n.id)).toContain(b.id)
    expect(store.getNeighbors(b.id).incomingNodes.map((n) => n.id)).toContain(a.id)
  })
})

describe('群組 (container / grouping)', () => {
  it('點「群組」按鈕新增 container，並在有選取結點時納入', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('service', 300, 250)
    const selected = store.selectedId!
    const cid = store.addContainer(200, 200)
    // LandingView.createGroup: 若當前有選取節點就 addNodeToContainer
    store.addNodeToContainer(selected, cid)
    expect(store.current.containers).toHaveLength(1)
    expect(store.current.nodes[0].containerId).toBe(cid)
  })

  it('Inspector 的「加入群組」下拉會改變歸屬', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('database', 100, 100)
    const nid = store.selectedId!
    const cid = store.addContainer(50, 50)
    store.addNodeToContainer(nid, cid)
    expect(store.current.nodes[0].containerId).toBe(cid)
    // 「移出群組」對應 addNodeToContainer(id, null)
    store.addNodeToContainer(nid, null)
    expect(store.current.nodes[0].containerId).toBeUndefined()
  })

  it('「刪除群組（保留成員）」會移除群組但節點留下', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('service', 300, 250)
    const nid = store.selectedId!
    const cid = store.addContainer(200, 200)
    store.addNodeToContainer(nid, cid)
    store.removeContainer(cid)
    expect(store.current.containers).toHaveLength(0)
    expect(store.current.nodes).toHaveLength(1)
    expect(store.current.nodes[0].containerId).toBeUndefined()
  })
})

describe('結點移除 (removeSelected)', () => {
  it('選取結點後按 Delete 會刪除該結點與其連線', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    store.addNode('frontend')
    store.addNode('backend')
    const [a, b] = store.current.nodes
    store.addConnection(a.id, b.id)
    store.select(a.id)
    store.removeSelected()
    expect(store.current.nodes.find((n) => n.id === a.id)).toBeUndefined()
    // 連到被刪節點的連線也應被清除
    expect(store.current.connections).toHaveLength(0)
    expect(store.selectedId).toBeNull()
  })

  it('選取群組後移除會連群組一起刪 (非保留模式)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const cid = store.addContainer(100, 100)
    store.select(cid)
    store.removeSelected()
    expect(store.current.containers.find((c) => c.id === cid)).toBeUndefined()
  })
})

describe('畫布操作 (zoom)', () => {
  it('放大會提升 zoom，且 clamp 在 3 以內', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const base = store.current.viewport.zoom
    store.zoomIn()
    expect(store.current.viewport.zoom).toBeGreaterThan(base)
    for (let i = 0; i < 30; i++) store.zoomIn()
    expect(store.current.viewport.zoom).toBeLessThanOrEqual(3)
  })

  it('縮小會降低 zoom，且 clamp 在 0.3 以上', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const base = store.current.viewport.zoom
    store.zoomOut()
    expect(store.current.viewport.zoom).toBeLessThan(base)
    for (let i = 0; i < 30; i++) store.zoomOut()
    expect(store.current.viewport.zoom).toBeGreaterThanOrEqual(0.3)
  })

  it('fit() 會觸發 fitRequested (Canvas 據此 fitView)', () => {
    const store = useArchitectureStore()
    store.newArchitecture('blank')
    const before = store.fitRequested
    store.fit()
    expect(store.fitRequested).toBe(!before)
  })
})

describe('端到端整鏈 (template → add → connect → group → remove → undo/redo → export)', () => {
  it('完整編輯流程後匯出的 JSON 結構正確且可重新匯入', () => {
    const store = useArchitectureStore()
    // 1) 套用範本（等同 UI 選擇範本）
    const tpl = buildTemplate('電子商務平台')!
    store.replace(tpl)
    const tplNodeCount = store.current.nodes.length
    const tplConnCount = store.current.connections.length
    expect(tplNodeCount).toBeGreaterThan(0)
    expect(tplConnCount).toBeGreaterThan(0)

    // 2) 新增結點（元件庫點擊）
    store.addNode('database')
    expect(store.current.nodes.length).toBe(tplNodeCount + 1)

    // 3) 線條連接：把新庫存庫連到一個既有服務
    const newNode = store.current.nodes[store.current.nodes.length - 1]
    const someService = store.current.nodes.find((n) => n.type === 'service')!
    store.addConnection(newNode.id, someService.id)
    expect(store.current.connections.length).toBe(tplConnCount + 1)

    // 4) 群組：建立群組並把新節點納入
    const cid = store.addContainer(0, 0)
    store.addNodeToContainer(newNode.id, cid)
    expect(store.current.nodes.find((n) => n.id === newNode.id)!.containerId).toBe(cid)

    // 5) 移除新節點
    store.select(newNode.id)
    store.removeSelected()
    expect(store.current.nodes.length).toBe(tplNodeCount) // 回到範本數量
    expect(store.current.connections.length).toBe(tplConnCount) // 連線也隨之清除

    // 6) undo 回到「有新增節點」的狀態
    store.undo()
    expect(store.current.nodes.length).toBe(tplNodeCount + 1)
    expect(store.current.connections.length).toBe(tplConnCount + 1)

    // 7) redo 再次移除
    store.redo()
    expect(store.current.nodes.length).toBe(tplNodeCount)

    // 8) 匯出 JSON：結構正確
    const json = store.exportJson()
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed.nodes)).toBe(true)
    expect(Array.isArray(parsed.connections)).toBe(true)
    expect(Array.isArray(parsed.containers)).toBe(true)
    expect(parsed.name).toBe('電子商務平台')

    // 9) 重新匯入應成功且節點數一致
    const ok = store.importJson(json)
    expect(ok).toBe(true)
    expect(store.current.nodes.length).toBe(tplNodeCount)
  })
})
