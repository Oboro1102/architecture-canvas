/**
 * Canvas 節點／相機共用型別。
 */

/** 世界座標中的節點視覺矩形（中心點 + 尺寸）。 */
export interface NodeVisual {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/** 相機：世界 → 螢幕 的平移與縮放。 */
export interface Camera2D {
  x: number
  y: number
  zoom: number
}

/** 相機操作（spec §18）：pan / zoom / fit / focus，含範圍限制。 */
export const CAMERA_LIMITS = {
  minZoom: 0.45,
  maxZoom: 2.6,
} as const

export function clampZoom(z: number): number {
  return Math.min(CAMERA_LIMITS.maxZoom, Math.max(CAMERA_LIMITS.minZoom, z))
}

export function worldToScreen(cam: Camera2D, wx: number, wy: number, cw: number, ch: number): [number, number] {
  return [(wx - cam.x) * cam.zoom + cw / 2, (wy - cam.y) * cam.zoom + ch / 2]
}

export function screenToWorld(cam: Camera2D, sx: number, sy: number, cw: number, ch: number): [number, number] {
  return [(sx - cw / 2) / cam.zoom + cam.x, (sy - ch / 2) / cam.zoom + cam.y]
}
