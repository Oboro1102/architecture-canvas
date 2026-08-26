import type { LLMRequest, LLMResponse } from '@/types/llm'

/**
 * V1: MockProvider only. V2 will add OpenAI / Gemini / Claude / Ollama providers.
 * UI and MockAgentEngine must not depend on any concrete LLM vendor.
 */
export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>
}

export class MockProvider implements LLMProvider {
  async generate(request: LLMRequest): Promise<LLMResponse> {
    return {
      agentId: request.agentId,
      message: '[Mock] Simulated agent response.',
      nextAction: 'continue',
    }
  }
}

let provider: LLMProvider = new MockProvider()

export function setProvider(p: LLMProvider): void {
  provider = p
}

export function getProvider(): LLMProvider {
  return provider
}
