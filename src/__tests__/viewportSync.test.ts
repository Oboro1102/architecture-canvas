/**
 * Verifies the canvas -> store half of the zoom sync: when Vue Flow reports a
 * viewport change (e.g. after fitView), the store's zoom must be updated so the
 * navbar % reflects reality. We mock @vue-flow/core's useVueFlow so we can
 * capture and manually fire the onViewportChange callback without needing a real
 * layout engine.
 */
import './setup'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { buildTemplate } from '@/types/architecture'

// Capture the onViewportChange handler Vue Flow would normally invoke.
let viewportChangeHandler: ((vp: { x: number; y: number; zoom: number }) => void) | null = null
// Capture the onNodesInitialized handler (fires after nodes are measured).
let nodesInitializedHandler: (() => void) | null = null
// Count fitView calls so we can assert a fit actually happened post-measure.
let fitViewCallCount = 0

vi.mock('@vue-flow/core', async (original) => {
  const mod = (await original()) as Record<string, unknown>
  return {
    ...mod,
    VueFlow: (mod.VueFlow as unknown),
    useVueFlow: () => ({
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      screenToFlowCoordinate: vi.fn(),
      zoomTo: vi.fn(),
      fitView: vi.fn((_opts?: unknown) => {
        fitViewCallCount++
        // Simulate Vue Flow reporting the new viewport after a fit.
        viewportChangeHandler?.({ x: 0, y: 0, zoom: 0.65 })
      }),
      onNodeDragStart: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragStop: vi.fn(),
      findNode: vi.fn(),
      updateNode: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeMouseEnter: vi.fn(),
      onNodeMouseLeave: vi.fn(),
      onPaneClick: vi.fn(),
      onConnect: vi.fn(),
      onViewportChange: (cb: (vp: { x: number; y: number; zoom: number }) => void) => {
        viewportChangeHandler = cb
      },
      onNodesInitialized: (cb: () => void) => {
        nodesInitializedHandler = cb
      },
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
  }
})

import ArchitectureCanvas from '@/components/architecture/ArchitectureCanvas.vue'
import { useArchitectureStore } from '@/stores/architecture'

beforeEach(() => {
  setActivePinia(createPinia())
  viewportChangeHandler = null
  nodesInitializedHandler = null
  fitViewCallCount = 0
})

describe('縮放反向同步 (canvas -> store)', () => {
  it('fitView 後 Vue Flow 回報的 zoom 會回寫 store，navbar 顯示更新', async () => {
    const store = useArchitectureStore()
    mount(ArchitectureCanvas, { attachTo: document.body })
    await nextTick()

    // The component registers an onViewportChange handler on mount.
    expect(viewportChangeHandler).toBeTruthy()

    // Simulate Vue Flow reporting a post-fit viewport (zoom 0.65).
    viewportChangeHandler!({ x: 0, y: 0, zoom: 0.65 })
    await nextTick()

    // Store must reflect the live zoom so the navbar % is honest.
    expect(store.current.viewport.zoom).toBeCloseTo(0.65, 5)
    expect(Math.round(store.current.viewport.zoom * 100)).toBe(65)
  })

  it('反向回寫不會與 store->canvas 方向打架 (無 echo 振盪)', async () => {
    const store = useArchitectureStore()
    mount(ArchitectureCanvas, { attachTo: document.body })
    await nextTick()

    // Fire several viewport changes; store should track the latest without
    // triggering a runaway zoomTo loop (guarded by the 1e-3 diff check).
    viewportChangeHandler!({ x: 0, y: 0, zoom: 0.5 })
    await nextTick()
    expect(store.current.viewport.zoom).toBeCloseTo(0.5, 5)

    viewportChangeHandler!({ x: 0, y: 0, zoom: 1.5 })
    await nextTick()
    expect(store.current.viewport.zoom).toBeCloseTo(1.5, 5)
  })
})

describe('啟動 / 切換範本後自動符合 (fit on init + template switch)', () => {
  it('掛載後等待節點量測完成，會自動 fit 一次 (啟動)', async () => {
    mount(ArchitectureCanvas, { attachTo: document.body })
    await nextTick()

    // On mount the component requests a fit but waits for measurement.
    expect(nodesInitializedHandler).toBeTruthy()
    expect(fitViewCallCount).toBe(0) // not fit before nodes are measured

    // Vue Flow finishes measuring the initial template nodes.
    nodesInitializedHandler!()
    await nextTick()
    await nextTick()

    // A genuine fitView must have fired (frames the freshly measured canvas).
    expect(fitViewCallCount).toBe(1)
  })

  it('切換範本 (store.replace 換掉節點陣列) 後，節點重新量測會自動 fit 一次', async () => {
    const store = useArchitectureStore()
    mount(ArchitectureCanvas, { attachTo: document.body })
    await nextTick()

    // Initial fit after first measurement.
    nodesInitializedHandler!()
    await nextTick()
    await nextTick()
    expect(fitViewCallCount).toBe(1)

    // User switches template: replace the architecture. The canvas watches the
    // nodes ARRAY REFERENCE, so this swap requests a fit (no explicit fit() call).
    store.replace(buildTemplate('微服務架構') ?? store.current)
    await nextTick()

    // Before the new nodes are measured, no second fit yet (we fit the NEW
    // content, not the outgoing one).
    expect(fitViewCallCount).toBe(1)

    // Vue Flow re-measures the replaced node set...
    nodesInitializedHandler!()
    await nextTick()
    await nextTick()

    // ...and a fresh fit runs for the new template. (Regression: previously the
    // boolean-flag approach left fit stuck after the first call.)
    expect(fitViewCallCount).toBe(2)
  })
})
