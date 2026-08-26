/**
 * V2 — LLM abstraction per spec §12–15.
 * UI and Workflow Engine must not depend on any concrete LLM vendor.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface LLMTool {
  name: string
  description: string
  schema: unknown
}

export interface LLMRequest {
  model: string
  systemPrompt?: string
  messages: LLMMessage[]
  tools?: LLMTool[]
  temperature?: number
}

export interface LLMToolCall {
  id: string
  name: string
  arguments: string
}

export interface LLMUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface LLMResponse {
  content: string
  toolCalls?: LLMToolCall[]
  usage?: LLMUsage
  finishReason?: string
}

export type AIMode = 'mock' | 'real'

export type ProviderId = 'mock' | 'openai' | 'gemini' | 'claude'

/** Spec §45 */
export interface ModelOption {
  id: string
  name: string
  provider: string
}

export interface ProviderConfig {
  provider: ProviderId
  apiKey?: string
  model?: string
}

/** Spec §39 — all errors map to a standard application error type. */
export type AgentErrorType =
  | 'authentication'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'validation'
  | 'tool'
  | 'unknown'

export class LLMError extends Error {
  readonly type: AgentErrorType

  constructor(type: AgentErrorType, message: string) {
    super(message)
    this.name = 'LLMError'
    this.type = type
  }
}

export interface ProviderConnectionResult {
  ok: boolean
  errorType?: AgentErrorType
  message: string
}

/**
 * Spec §12 — V2 provider contract. testConnection() lets the Settings UI
 * verify an API key before entering Real AI Mode.
 */
export interface LLMProvider {
  readonly id: ProviderId
  readonly name: string

  generate(request: LLMRequest): Promise<LLMResponse>
  testConnection(): Promise<ProviderConnectionResult>
}
