import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ProviderConfig,
  ProviderConnectionResult,
} from '@/types/llm'
import { OpenAIProvider } from './openai'

/**
 * Spec §5/§42 — mock provider keeps V1 fully functional with zero network.
 * Usage is deliberately undefined: the UI shows N/A, never fabricated tokens (§15).
 */
export class MockProvider implements LLMProvider {
  readonly id = 'mock' as const
  readonly name = 'Simulation'

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user')
    return {
      content: `[Mock] Simulated response for: ${lastUser?.content ?? request.model}`,
      finishReason: 'stop',
      // usage intentionally omitted → UI renders "N/A" (spec §15)
    }
  }

  async testConnection(): Promise<ProviderConnectionResult> {
    return { ok: true, message: 'Simulation mode requires no API key.' }
  }
}

/** Spec §51 — Provider Factory. */
export function createLLMProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI provider requires an API key.')
      return new OpenAIProvider(config.apiKey)
    case 'mock':
      return new MockProvider()
    case 'gemini':
    case 'claude':
      throw new Error(`${config.provider} provider not implemented yet.`)
  }
}
