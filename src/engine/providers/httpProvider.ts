import {
  LLMError,
  type LLMRequest,
  type LLMResponse,
  type ProviderConnectionResult,
  type ProviderId,
} from '@/types/llm'

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Map fetch/HTTP failures to standard AgentErrorType (spec §39).
 * Never includes the API key or Authorization header in messages (§49).
 */
export function classifyHttpError(status: number): LLMError {
  switch (status) {
    case 401:
    case 403:
      return new LLMError('authentication', 'Authentication failed. Check your API key.')
    case 429:
      return new LLMError('rate_limit', 'Rate limit reached. Wait before retrying.')
    case 404:
      return new LLMError('invalid_response', `Model not found (HTTP ${status}).`)
    default:
      return new LLMError('unknown', `Provider request failed (HTTP ${status}).`)
  }
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw classifyHttpError(response.status)
    return response
  } catch (error) {
    if (error instanceof LLMError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LLMError('timeout', 'Request timed out.')
    }
    throw new LLMError('network', 'Network error while contacting the provider.')
  } finally {
    clearTimeout(timer)
  }
}

/** Shared shape for real HTTP-backed providers (OpenAI now; Gemini/Claude later). */
export abstract class HttpLLMProvider {
  readonly id: ProviderId

  protected constructor(
    id: ProviderId,
    protected apiKey: string,
  ) {
    this.id = id
  }

  protected abstract endpoint(): string
  protected abstract buildHeaders(): Record<string, string>
  protected abstract buildBody(request: LLMRequest, maxTokens: number): unknown
  protected abstract parseResponse(json: unknown): LLMResponse
  /** Minimal request used by testConnection(). */
  protected abstract connectionProbeModel(): string

  async generate(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const body = this.buildBody(request, 1024)
    try {
      const response = await postJson(this.endpoint(), this.buildHeaders(), body, signal)
      const json: unknown = await response.json()
      return this.parseResponse(json)
    } catch (error) {
      if (error instanceof LLMError) throw error
      throw new LLMError('invalid_response', 'Could not parse provider response.')
    }
  }

  async testConnection(): Promise<ProviderConnectionResult> {
    try {
      const probe: LLMRequest = {
        model: this.connectionProbeModel(),
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
      }
      await postJson(this.endpoint(), this.buildHeaders(), this.buildBody(probe, 1))
      return { ok: true, message: 'Connected' }
    } catch (error) {
      const type = error instanceof LLMError ? error.type : 'unknown'
      const message = error instanceof Error ? error.message : 'Connection test failed.'
      return { ok: false, errorType: type, message }
    }
  }
}
