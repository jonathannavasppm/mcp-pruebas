export interface SourceConfig {
  id: string
  sheetName: string
  type: "http" | "file" | "npm-audit" | "sonarqube" | "uptime-robot" | "jira"
  enabled: boolean
  config: Record<string, unknown>
}

export interface ProjectConfig {
  name: string
  sources: SourceConfig[]
}

export interface AppConfig {
  outputFile: string
  projects: ProjectConfig[]
}

export interface ExcelSummary {
  filePath: string
  sheets: SheetSummary[]
}

export interface SheetSummary {
  name: string
  rowCount: number
}

export interface RowData {
  [column: string]: string | number | boolean | null | undefined
}

export interface CollectedResult {
  sheetName: string
  rows: RowData[]
  errors: string[]
}

export interface FootballMatchRow extends RowData {
  competition: string
  matchDate: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string
  sourceUrl: string
}

export interface DependencyRow extends RowData {
  packageName: string
  dependencyType:
    "dependency" | "devDependency" | "optionalDependency" | "peerDependency"
  installedVersion: string
  currentVersion: string | null
  latestVersion: string | null
  isUpToDate: boolean
  isDeprecated: boolean
  hasVulnerabilities: boolean
  vulnerabilitySeverity: "low" | "moderate" | "high" | "critical" | null
  lastPublishedDate: string | null
  maintenanceStatus: "ok" | "outdated" | "deprecated" | "unmaintained" | null
  advisoryUrl: string | null
}

export interface SonarQubeRow extends RowData {
  projectKey: string
  branch: string
  metric: string
  value: string | number
  url: string
}

export interface UptimeRobotRow extends RowData {
  monitorId: number
  friendlyName: string
  url: string
  status: string
  uptimeRatio: number
  lastLogDate: string | null
}

export interface JiraRow extends RowData {
  issueKey: string
  summary: string
  status: string
  priority: string
  assignee: string | null
  reporter: string
  created: string
  updated: string
  url: string
}

export interface BranchMismatchPayload {
  projectPath: string
  currentBranch: string
  expectedBranch: string
}

export interface ToolResponse extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export interface RateLimiterEntry {
  count: number
  resetTime: number
}
