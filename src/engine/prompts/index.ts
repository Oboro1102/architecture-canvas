import type { Agent } from '@/types/agent'
import { ROLE_LABEL_EN } from '@/types/agent'
import type { Task } from '@/types/task'
import type { Project } from '@/types/project'

/**
 * Spec §59 — prompts are built centrally, never inside components.
 * System Role + Company Rules + Agent Role + Project/Task Context
 * + Available Tools + Output Schema.
 */

/** Spec §60 — versioned prompt definitions. */
export interface PromptDefinition {
  id: string
  version: string
  systemPrompt: string
}

const COMPANY_RULES = `You are one member of an AI software company.
Rules:
- Stay strictly within your own role's responsibilities.
- Produce concrete, actionable output based on the ACTUAL project requirement given — never generic filler.
- You may call the provided tools to create or update tasks and read project state.
- Respond ONLY with a single JSON object matching the Output Schema. No markdown fences, no prose.`

const OUTPUT_SCHEMA = `Output Schema (JSON):
{
  "status": "success" | "failed" | "blocked" | "needs_approval",
  "message": "one-sentence summary of what you did",
  "tasks": [ { "title": "...", "description": "...", "priority": "high"|"medium"|"low", "assigneeRole": "${'ceo'}|cto|product|designer|frontend|backend|qa" } ],
  "nextAction": "short description of suggested next step"
}
The "tasks" array may be empty. Use status "blocked" if you cannot proceed; "needs_approval" only for high-risk actions.`

function agentRoleBlock(agent: Agent): string {
  const responsibilities = agent.responsibilities.map((r) => `- ${r}`).join('\n')
  return `Agent Role: ${agent.name} (${ROLE_LABEL_EN[agent.role]})
Responsibilities:
${responsibilities}`
}

function contextBlock(project: Project, tasks: Task[]): string {
  const taskLines = tasks.length
    ? tasks.map((t) => `- [${t.id}] ${t.title} (${t.status}, ${t.priority})`).join('\n')
    : '- (no tasks yet)'
  return `Project: ${project.name}
Requirement: ${project.description}

Current tasks:
${taskLines}`
}

/** Build the full system prompt for one agent run (§59). */
export function buildSystemPrompt(agent: Agent, project: Project, tasks: Task[], toolNames: string[]): string {
  return [
    COMPANY_RULES,
    agentRoleBlock(agent),
    contextBlock(project, tasks),
    `Available tools: ${toolNames.length ? toolNames.join(', ') : '(none)'}`,
    OUTPUT_SCHEMA,
  ].join('\n\n')
}

export function buildUserMessage(project: Project, agent: Agent): string {
  return `Analyze the requirement above and act as ${agent.name}. Base everything on the stated requirement.`
}

/** The shared planner prompt id/version recorded on execution events (§60). */
export const AGENT_PLANNER_PROMPT: PromptDefinition = {
  id: 'agent-planner',
  version: '1.0',
  systemPrompt: COMPANY_RULES,
}
