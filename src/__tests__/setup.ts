// Test environment shims for component tests that mount Vue Flow.
// jsdom lacks ResizeObserver (Vue Flow needs it to measure the container) and
// the Vue Flow stylesheet. We stub both so components can mount headlessly.
import '@vue-flow/core/dist/style.css'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error - assign to jsdom global
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub
