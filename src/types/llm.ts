export interface LLMRequest {
  agentId: string
  prompt: string
  context?: Record<string, unknown>
}

export interface LLMResponse {
  agentId: string
  message: string
  nextAction: string
}
