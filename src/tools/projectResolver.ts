import type {
  ProjectConfigOutput,
  SourceConfigOutput,
} from "../config/schema.js"
import { logger } from "../utils/logger.js"

interface NpmAuditEnvConfig {
  enabled?: boolean
  path?: string
  branch?: string
  timeToCompare?: string
}

interface SonarQubeEnvConfig {
  enabled?: boolean
  baseUrl?: string
  projectKey?: string
  branch?: string
  metrics?: string[]
  apiKeyEnv?: string
}

interface UptimeRobotEnvConfig {
  enabled?: boolean
  projectName?: string
  apiKeyEnv?: string
}

interface JiraEnvConfig {
  enabled?: boolean
  projectName?: string
  jql?: string
  apiKeyEnv?: string
  emailEnv?: string
  baseUrlEnv?: string
}

interface ProjectEnvEntry {
  name: string
  path: string
  branch?: string
  timeToCompare?: string
  npmAudit?: NpmAuditEnvConfig
  sonarqube?: SonarQubeEnvConfig
  uptimeRobot?: UptimeRobotEnvConfig
  jira?: JiraEnvConfig
}

function isProjectEnvEntry(item: unknown): item is ProjectEnvEntry {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as ProjectEnvEntry).name === "string" &&
    typeof (item as ProjectEnvEntry).path === "string" &&
    (item as ProjectEnvEntry).name.length > 0 &&
    (item as ProjectEnvEntry).path.length > 0
  )
}

function createNpmAuditSource(
  entry: ProjectEnvEntry
): SourceConfigOutput | null {
  const cfg = entry.npmAudit || {}
  if (cfg.enabled === false) return null

  return {
    id: "vulnerabilities",
    sheetName: `${entry.name} - Vulnerabilidades`,
    type: "npm-audit",
    enabled: true,
    config: {
      pathProject: cfg.path || entry.path,
      branch: cfg.branch || entry.branch || "main",
      timeToCompare: cfg.timeToCompare || entry.timeToCompare || "6 months",
    },
  }
}

function createSonarQubeSource(
  entry: ProjectEnvEntry
): SourceConfigOutput | null {
  const cfg = entry.sonarqube
  if (!cfg || cfg.enabled === false) return null

  const projectKey = cfg.projectKey || entry.name
  const baseUrl = cfg.baseUrl
  const branch = cfg.branch || entry.branch || "main"
  const metrics =
    cfg.metrics && cfg.metrics.length > 0
      ? cfg.metrics
      : ["coverage", "bugs", "vulnerabilities", "code_smells"]

  if (!baseUrl) {
    logger.warn(
      { projectName: entry.name },
      "Skipping sonarqube source: missing baseUrl"
    )
    return null
  }

  return {
    id: "code-quality",
    sheetName: `${entry.name} - SonarQube`,
    type: "sonarqube",
    enabled: true,
    config: {
      apiKeyEnv: cfg.apiKeyEnv || "SONARQUBE_API_KEY",
      baseUrl,
      projectKey,
      branch,
      metrics,
    },
  }
}

function createUptimeRobotSource(
  entry: ProjectEnvEntry
): SourceConfigOutput | null {
  const cfg = entry.uptimeRobot
  if (!cfg || cfg.enabled === false) return null

  if (!cfg.projectName) {
    logger.warn(
      { projectName: entry.name },
      "Skipping uptimeRobot source: missing projectName"
    )
    return null
  }

  return {
    id: "uptime",
    sheetName: `${entry.name} - UptimeRobot`,
    type: "uptime-robot",
    enabled: true,
    config: {
      apiKeyEnv: cfg.apiKeyEnv || "UPTIME_ROBOT_API_KEY",
      projectName: cfg.projectName,
    },
  }
}

function createJiraSource(entry: ProjectEnvEntry): SourceConfigOutput | null {
  const cfg = entry.jira
  if (!cfg || cfg.enabled === false) return null

  if (!cfg.projectName) {
    logger.warn(
      { projectName: entry.name },
      "Skipping jira source: missing projectName"
    )
    return null
  }

  const jql =
    cfg.jql ||
    `project = '${cfg.projectName}' AND status != Done ORDER BY created DESC`

  return {
    id: "jira",
    sheetName: `${entry.name} - Jira`,
    type: "jira",
    enabled: true,
    config: {
      apiKeyEnv: cfg.apiKeyEnv || "JIRA_API_TOKEN",
      emailEnv: cfg.emailEnv || "JIRA_EMAIL",
      baseUrlEnv: cfg.baseUrlEnv || "JIRA_URL",
      projectName: cfg.projectName,
      jql,
    },
  }
}

function createDynamicSources(entry: ProjectEnvEntry): SourceConfigOutput[] {
  const sources: (SourceConfigOutput | null)[] = [
    createNpmAuditSource(entry),
    createSonarQubeSource(entry),
    createUptimeRobotSource(entry),
    createJiraSource(entry),
  ]

  return sources.filter(
    (source): source is SourceConfigOutput => source !== null
  )
}

function createDynamicProject(entry: ProjectEnvEntry): ProjectConfigOutput {
  return {
    name: entry.name,
    sources: createDynamicSources(entry),
  }
}

export function resolveProjectsFromEnv(
  configProjects: ProjectConfigOutput[]
): ProjectConfigOutput[] {
  const envProjects = parseProjectsEnv()
  if (envProjects.length === 0) {
    return configProjects
  }

  return envProjects.map(createDynamicProject)
}

export function resolveProjectFromEnv(
  name: string
): ProjectConfigOutput | undefined {
  const entry = parseProjectsEnv().find((p) => p.name === name)
  if (!entry) return undefined
  return createDynamicProject(entry)
}

export function hasProjectsEnvOverride(): boolean {
  return !!process.env.PROJECTS && process.env.PROJECTS.trim().length > 0
}

function parseProjectsJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return JSON.parse(raw.replaceAll('\\"', '"')) as unknown
  }
}

function parseProjectsEnv(): ProjectEnvEntry[] {
  const raw = process.env.PROJECTS
  if (!raw || raw.trim().length === 0) return []

  try {
    const parsed = parseProjectsJson(raw)
    if (!Array.isArray(parsed)) {
      logger.warn(
        { projectsEnv: raw },
        "PROJECTS environment variable must be a JSON array"
      )
      return []
    }

    return parsed.filter(isProjectEnvEntry)
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : error,
        projectsEnv: raw,
      },
      "Unable to parse PROJECTS environment variable as JSON"
    )
    return []
  }
}
