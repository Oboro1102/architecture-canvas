import { ROLE_LABEL_EN, type AgentRole } from './agent'

/**
 * Spec §57 — a lightweight project descriptor for Real AI runs.
 * (V1's "project" lives implicitly in company store; V2 makes it explicit.)
 */
export interface Project {
  name: string
  description: string
  requirements: string[]
}

export function projectFromCompany(
  name: string,
  requirement: string,
  role?: AgentRole,
): Project {
  return {
    name,
    description: requirement,
    requirements: [requirement],
    ...(role ? {} : {}),
  }
}

export const AGENT_ROLE_EN = ROLE_LABEL_EN
