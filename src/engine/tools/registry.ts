import type { AgentTool, AgentToolCall } from '@/types/agentRuntime'
import {
  createTaskTool,
  updateTaskTool,
  getProjectStateTool,
  getTaskTool,
  searchKnowledgeTool,
  requestApprovalTool,
} from './index'

/** Spec §28 — validate → execute → result. Throws on invalid arguments. */
export function getTool(name: string): AgentTool | undefined {
  const tools = toolRegistry()
  return tools.find((t) => t.name === name)
}

export function toolRegistry(): AgentTool[] {
  return [
    createTaskTool as unknown as AgentTool,
    updateTaskTool as unknown as AgentTool,
    getProjectStateTool as unknown as AgentTool,
    getTaskTool as unknown as AgentTool,
    searchKnowledgeTool as unknown as AgentTool,
    requestApprovalTool as unknown as AgentTool,
  ]
}

export async function runToolCall(call: { name: string; arguments: unknown }): Promise<AgentToolCall> {
  const tool = getTool(call.name)
  if (!tool) throw new Error(`Unknown tool: ${call.name}`)
  // Basic schema validation: required fields must be present.
  const schema = tool.schema as { required?: string[] } | undefined
  const args = (call.arguments ?? {}) as Record<string, unknown>
  for (const key of schema?.required ?? []) {
    if (args[key] === undefined || args[key] === null) {
      throw new Error(`Tool ${call.name}: missing required argument "${key}".`)
    }
  }
  const result = await tool.execute(args)
  return { name: call.name, arguments: args, result }
}
