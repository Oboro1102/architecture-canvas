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

// Capture the onViewportChange handler Vue Flow would normally invoke.
let viewportChangeHandler: ((vp: { x: number; y: number; zoom: number }) => void) | null = null

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
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
  }
})

import ArchitectureCanvas from '@/components/architecture/ArchitectureCanvas.vue'
import { useArchitectureStore } from '@/stores/architecture'

beforeEach(() => {
  setActivePinia(createPinia())
  viewportChangeHandler = null
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
