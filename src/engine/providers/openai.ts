import type { LLMRequest, LLMResponse, ModelOption } from '@/types/llm'
import { HttpLLMProvider } from './httpProvider'

/**
 * Spec §6 — first real provider. Chat Completions via browser fetch (BYOK, §61).
 */
export class OpenAIProvider extends HttpLLMProvider {
  readonly name = 'OpenAI'

  constructor(apiKey: string) {
    super('openai', apiKey)
  }

  protected endpoint(): string {
    return 'https://api.openai.com/v1/chat/completions'
  }

  protected buildHeaders(): Record<string, string> {
    // Never logged or persisted (§49).
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  protected buildBody(request: LLMRequest, maxTokens: number): unknown {
    const messages: unknown[] = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    for (const m of request.messages) {
      messages.push({ role: m.role === 'tool' ? 'assistant' : m.role, content: m.content })
    }
    return {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: maxTokens,
    }
  }

  protected parseResponse(json: unknown): LLMResponse {
    const data = json as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const choice = data.choices?.[0]
    if (!choice) {
      throw Object.assign(new Error('Empty response from OpenAI.'), { errorType: 'invalid_response' })
    }
    const usage = data.usage
    return {
      content: choice.message?.content ?? '',
      finishReason: choice.finish_reason,
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    }
  }

  protected connectionProbeModel(): string {
    return 'gpt-4o-mini'
  }
}

/** Spec §45 — provider owns its model list; UI renders these options. */
export const OPENAI_MODELS: ModelOption[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
]
