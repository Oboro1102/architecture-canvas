/**
 * Compatibility re-export. The real implementation lives in
 * `engine/providers/` (spec §12, §50). New code should import from there.
 */
export { MockProvider, createLLMProvider } from './providers'
export type { LLMProvider } from '@/types/llm'
