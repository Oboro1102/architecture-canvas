/**
 * Agent Avatar 抽象層
 *
 * 目前實作：DiceBear Bottts（本地生成 SVG，離線可用）。
 * 未來替換：只要改寫這個檔案內部的實作即可，呼叫端（AgentAvatar.vue 等）不用動。
 * 備選方案：
 *   - 其他 DiceBear 樣式：@dicebear/adventurer、@dicebear/pixel-art …
 *   - 自訂 spritesheet：改回傳 data URL 或靜態資源路徑（搭配 <img>）
 *   - V2 接真實 LLM：可換成 LLM 生成的角色立繪 URL
 */
import { createAvatar } from '@dicebear/core'
import * as bottts from '@dicebear/bottts'

/** 依 seed 生成頭像 SVG 字串。同一個 seed 永遠生成同一個角色。 */
export function createAgentAvatar(seed: string): string {
  return createAvatar(bottts, { seed }).toString()
}
