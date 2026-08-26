import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLLMProvider, MockProvider } from '@/engine/providers'
import { OpenAIProvider, OPENAI_MODELS } from '@/engine/providers/openai'
import { classifyHttpError } from '@/engine/providers/httpProvider'

describe('MockProvider', () => {
  it('returns a simulated response without usage', async () => {
    const provider = new MockProvider()
    const res = await provider.generate({
      model: 'mock-1',
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(res.content).toContain('[Mock]')
    expect(res.usage).toBeUndefined()
    const conn = await provider.testConnection()
    expect(conn.ok).toBe(true)
  })
})

describe('createLLMProvider factory', () => {
  it('creates mock provider without key', () => {
    expect(createLLMProvider({ provider: 'mock' })).toBeInstanceOf(MockProvider)
  })
  it('creates openai provider with key', () => {
    expect(createLLMProvider({ provider: 'openai', apiKey: 'sk-test' })).toBeInstanceOf(
      OpenAIProvider,
    )
  })
  it('rejects openai without key', () => {
    expect(() => createLLMProvider({ provider: 'openai' })).toThrow(/API key/)
  })
  it('rejects unimplemented providers', () => {
    expect(() => createLLMProvider({ provider: 'gemini' })).toThrow(/not implemented/)
  })
})

describe('OpenAIProvider', () => {
  const okBody = {
    choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends auth header and parses response with usage', async () => {
    const provider = new OpenAIProvider('sk-secret')
    const fetchMock = vi.mocked(globalThis.fetch)
    const res = await provider.generate({
      model: 'gpt-4o-mini',
      systemPrompt: 'be brief',
      messages: [{ role: 'user', content: 'say hi' }],
    })
    expect(res.content).toBe('hi there')
    expect(res.usage?.totalTokens).toBe(15)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('Authorization')).toBe('Bearer sk-secret')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' })
  })

  it('maps HTTP 401 to authentication error and never leaks the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":{}}', { status: 401 })),
    )
    const result = await new OpenAIProvider('sk-leaky').testConnection()
    expect(result.ok).toBe(false)
    expect(result.errorType).toBe('authentication')
    expect(result.message).not.toContain('sk-leaky')
  })

  it('test connection succeeds on 200', async () => {
    const result = await new OpenAIProvider('sk-test').testConnection()
    expect(result.ok).toBe(true)
  })
})

describe('classifyHttpError', () => {
  it('classifies known statuses', () => {
    expect(classifyHttpError(401).type).toBe('authentication')
    expect(classifyHttpError(429).type).toBe('rate_limit')
    expect(classifyHttpError(404).type).toBe('invalid_response')
    expect(classifyHttpError(500).type).toBe('unknown')
  })
})

describe('OPENAI_MODELS', () => {
  it('offers at least one model option per spec §45', () => {
    expect(OPENAI_MODELS.length).toBeGreaterThan(0)
    for (const m of OPENAI_MODELS) expect(m.provider).toBe('openai')
  })
})
