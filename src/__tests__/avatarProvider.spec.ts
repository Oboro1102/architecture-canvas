import { describe, expect, it } from 'vitest'
import { createAgentAvatar } from '@/engine/avatarProvider'

describe('avatarProvider', () => {
  it('產生 SVG 字串', () => {
    const svg = createAgentAvatar('ceo')
    expect(svg).toContain('<svg')
  })

  it('同一個 seed 產生相同頭像（確定性）', () => {
    expect(createAgentAvatar('cto')).toBe(createAgentAvatar('cto'))
  })

  it('不同 seed 產生不同頭像', () => {
    expect(createAgentAvatar('ceo')).not.toBe(createAgentAvatar('qa'))
  })
})
