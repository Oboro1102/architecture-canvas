import { ref } from 'vue'

// Module-level shared ref that bridges the clicked node's on-screen rectangle
// from ArchitectureCanvas (writer) to FloatingInspector (reader), so the
// inspector can anchor itself next to the node without prop-drilling a
// component instance through LandingView.
export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

const nodeScreenRect = ref<ScreenRect | null>(null)

export function useNodeScreenRect() {
  function setRect(r: ScreenRect | null) {
    nodeScreenRect.value = r
  }
  return { nodeScreenRect, setRect }
}
