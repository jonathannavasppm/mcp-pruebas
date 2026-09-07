import type { Connector, ConnectorContext } from "./base.js"
import type { JiraRow, RowData } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { getRequiredEnv } from "../utils/env.js"
import { McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

interface JiraSourceConfig {
  apiKeyEnv?: string
  emailEnv?: string
  baseUrlEnv?: string
  projectName: string
  jql?: string
  maxResults?: number
}

interface JiraIssue {
  key: string
  fields: {
    summary: string
    status: { name: string }
    priority?: { name: string }
    assignee?: { displayName: string }
    reporter?: { displayName: string }
    created: string
    updated: string
  }
}

interface JiraSearchResponse {
  issues?: JiraIssue[]
}

export class JiraConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as JiraSourceConfig
    if (!cfg.projectName || typeof cfg.projectName !== "string") {
      throw new McpAppError(
        `jira source "${source.id}" requires "projectName" in config`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as JiraSourceConfig
    const apiToken = cfg.apiKeyEnv
      ? getRequiredEnv(cfg.apiKeyEnv)
      : getRequiredEnv("JIRA_API_TOKEN")
    const email = cfg.emailEnv
      ? getRequiredEnv(cfg.emailEnv)
      : getRequiredEnv("JIRA_EMAIL")
    const baseUrl = (
      cfg.baseUrlEnv
        ? getRequiredEnv(cfg.baseUrlEnv)
        : getRequiredEnv("JIRA_URL")
    ).replace(/\/$/, "")

    const maxResults = cfg.maxResults ?? 50
    const jql =
      cfg.jql || `project = "${cfg.projectName}" ORDER BY created DESC`

    logger.info(
      { sourceId: ctx.sourceId, projectName: ctx.projectName, jql },
      "Fetching Jira issues"
    )

    const auth = Buffer.from(`${email}:${apiToken}`).toString("base64")
    const url = `${baseUrl}/rest/api/3/search?${new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      fields: "summary,status,priority,assignee,reporter,created,updated",
    }).toString()}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      throw new McpAppError(
        `Jira API returned status ${response.status}: ${response.statusText}`
      )
    }

    const data = (await response.json()) as JiraSearchResponse
    const issues = data.issues || []

    return issues.map((issue) => ({
      issueKey: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || "None",
      assignee: issue.fields.assignee?.displayName || null,
      reporter: issue.fields.reporter?.displayName || "Unknown",
      created: issue.fields.created,
      updated: issue.fields.updated,
      url: `${baseUrl}/browse/${issue.key}`,
    })) as JiraRow[]
  }
}
