/**
 * Future tool architecture (V2+). V1 defines the interface and a registry;
 * no real tool is implemented.
 */
export interface AgentTool {
  name: string
  description: string
  execute(input: unknown): Promise<unknown>
}

const registry = new Map<string, AgentTool>()

export function registerTool(tool: AgentTool): void {
  registry.set(tool.name, tool)
}

export function listTools(): AgentTool[] {
  return [...registry.values()]
}
