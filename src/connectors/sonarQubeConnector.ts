import type { Connector, ConnectorContext } from "./base.js"
import type { RowData, SonarQubeRow } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { getRequiredEnv } from "../utils/env.js"
import { McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

interface SonarQubeSourceConfig {
  apiKeyEnv?: string
  baseUrl: string
  projectKey: string
  branch: string
  metrics: string[]
}

interface SonarQubeMeasureResponse {
  component?: {
    measures?: Array<{
      metric: string
      value?: string
      period?: { value?: string }
    }>
  }
}

export class SonarQubeConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as SonarQubeSourceConfig
    if (!cfg.baseUrl || typeof cfg.baseUrl !== "string") {
      throw new McpAppError(
        `sonarqube source "${source.id}" requires "baseUrl" in config`
      )
    }
    if (!cfg.projectKey || typeof cfg.projectKey !== "string") {
      throw new McpAppError(
        `sonarqube source "${source.id}" requires "projectKey" in config`
      )
    }
    if (!cfg.branch || typeof cfg.branch !== "string") {
      throw new McpAppError(
        `sonarqube source "${source.id}" requires "branch" in config`
      )
    }
    if (
      !cfg.metrics ||
      !Array.isArray(cfg.metrics) ||
      cfg.metrics.length === 0
    ) {
      throw new McpAppError(
        `sonarqube source "${source.id}" requires a non-empty "metrics" array in config`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as SonarQubeSourceConfig
    const baseUrl = cfg.baseUrl.replace(/\/$/, "")
    const apiKey = cfg.apiKeyEnv
      ? getRequiredEnv(cfg.apiKeyEnv)
      : getRequiredEnv("SONARQUBE_API_KEY")

    const metricsParam = cfg.metrics.join(",")
    const url = `${baseUrl}/api/measures/component?component=${encodeURIComponent(
      cfg.projectKey
    )}&branch=${encodeURIComponent(cfg.branch)}&metricKeys=${encodeURIComponent(
      metricsParam
    )}`

    logger.info(
      { sourceId: ctx.sourceId, projectName: ctx.projectName, url },
      "Fetching SonarQube metrics"
    )

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new McpAppError(
        `SonarQube API returned status ${response.status}: ${response.statusText}`
      )
    }

    const data = (await response.json()) as SonarQubeMeasureResponse
    const measures = data.component?.measures || []

    return measures.map((measure) => ({
      projectKey: cfg.projectKey,
      branch: cfg.branch,
      metric: measure.metric,
      value: measure.value ?? measure.period?.value ?? "N/A",
      url: `${baseUrl}/dashboard?id=${encodeURIComponent(
        cfg.projectKey
      )}&branch=${encodeURIComponent(cfg.branch)}`,
    })) as SonarQubeRow[]
  }
}
