/**
 * Component-level integration test for the zoom sync fix.
 *
 * Regression coverage for the bug where clicking the navbar zoom buttons left
 * the displayed percentage stuck at 100% (store.zoom changed but the canvas /
 * navbar display never reflected it).
 *
 * We mount the real LandingView (navbar + ArchitectureCanvas) and assert that
 * pressing "放大" updates BOTH the store zoom and the on-screen % label. This
 * exercises the two-way store <-> Vue Flow sync introduced in the fix.
 */
import './setup'
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import LandingView from '@/components/layout/LandingView.vue'
import { useArchitectureStore } from '@/stores/architecture'

// Vue Flow renders SVG nodes; jsdom has no layout engine but the mount + the
// reactive store<->UI binding still work, which is what we assert here.
beforeEach(() => {
  setActivePinia(createPinia())
})

describe('縮放顯示同步 (navbar zoom <-> store)', () => {
  it('點擊「放大」後 store.zoom 上升且 navbar 百分比文字隨之更新', async () => {
    const wrapper = mount(LandingView, { attachTo: document.body })
    const store = useArchitectureStore()

    // Grab the on-screen percentage label (e.g. "100%").
    const pctBefore = wrapper.text().match(/(\d+)%/)?.[1]
    expect(pctBefore).toBeTruthy()
    const zoomBefore = store.current.viewport.zoom
    expect(Number(pctBefore)).toBe(Math.round(zoomBefore * 100))

    // Click the zoom-in button (aria-label="放大").
    const zoomInBtn = wrapper.find('button[aria-label="放大"]')
    expect(zoomInBtn.exists()).toBe(true)
    await zoomInBtn.trigger('click')
    await nextTick()

    // Store zoom must have increased.
    expect(store.current.viewport.zoom).toBeGreaterThan(zoomBefore)

    // The visible % label must now reflect the new zoom (regression guard:
    // previously this stayed at 100% no matter how many times you clicked).
    const pctAfter = wrapper.text().match(/(\d+)%/)?.[1]
    expect(Number(pctAfter)).toBe(Math.round(store.current.viewport.zoom * 100))
    expect(Number(pctAfter)).toBeGreaterThan(Number(pctBefore))

    wrapper.unmount()
  })

  it('點擊「縮小」後百分比下降', async () => {
    const wrapper = mount(LandingView, { attachTo: document.body })
    const store = useArchitectureStore()

    const pctBefore = Number(wrapper.text().match(/(\d+)%/)?.[1])
    const zoomIn = wrapper.find('button[aria-label="縮小"]')
    await zoomIn.trigger('click')
    await nextTick()

    expect(store.current.viewport.zoom).toBeLessThan(1)
    const pctAfter = Number(wrapper.text().match(/(\d+)%/)?.[1])
    expect(pctAfter).toBe(Math.round(store.current.viewport.zoom * 100))
    expect(pctAfter).toBeLessThan(pctBefore)

    wrapper.unmount()
  })

  it('「符合畫布」按鈕可點擊不拋錯 (fit 流程)', async () => {
    const wrapper = mount(LandingView, { attachTo: document.body })
    const fitBtn = wrapper.find('button[aria-label="符合畫布"]')
    expect(fitBtn.exists()).toBe(true)
    await fitBtn.trigger('click')
    await nextTick()
    // No assertion on exact zoom (jsdom has no layout), just that the flow runs.
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })
})
