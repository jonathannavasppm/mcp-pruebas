import type { Connector, ConnectorContext } from "./base.js"
import type { RowData, UptimeRobotRow } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { getRequiredEnv } from "../utils/env.js"
import { McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

interface UptimeRobotSourceConfig {
  apiKeyEnv?: string
  projectName?: string
}

interface UptimeRobotMonitor {
  id: number
  friendly_name: string
  url: string
  status: number
  uptime_ratio: string
  logs?: Array<{ datetime: number }>
}

interface UptimeRobotResponse {
  monitors?: UptimeRobotMonitor[]
}

const STATUS_MAP: Record<number, string> = {
  0: "paused",
  1: "not checked yet",
  2: "up",
  8: "seems down",
  9: "down",
}

export class UptimeRobotConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as UptimeRobotSourceConfig
    if (cfg.projectName && typeof cfg.projectName !== "string") {
      throw new McpAppError(
        `uptime-robot source "${source.id}" requires "projectName" to be a string`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as UptimeRobotSourceConfig
    const apiKey = cfg.apiKeyEnv
      ? getRequiredEnv(cfg.apiKeyEnv)
      : getRequiredEnv("UPTIME_ROBOT_API_KEY")

    logger.info(
      { sourceId: ctx.sourceId, projectName: ctx.projectName },
      "Fetching Uptime Robot monitors"
    )

    const response = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_key: apiKey,
        format: "json",
        logs: "1",
      }),
    })

    if (!response.ok) {
      throw new McpAppError(
        `Uptime Robot API returned status ${response.status}: ${response.statusText}`
      )
    }

    const data = (await response.json()) as UptimeRobotResponse
    let monitors = data.monitors || []

    if (cfg.projectName) {
      const lowerProjectName = cfg.projectName.toLowerCase()
      monitors = monitors.filter((monitor) =>
        monitor.friendly_name.toLowerCase().includes(lowerProjectName)
      )
    }

    return monitors.map((monitor) => ({
      monitorId: monitor.id,
      friendlyName: monitor.friendly_name,
      url: monitor.url,
      status: STATUS_MAP[monitor.status] || `unknown (${monitor.status})`,
      uptimeRatio: parseFloat(monitor.uptime_ratio) || 0,
      lastLogDate: monitor.logs?.[0]?.datetime
        ? new Date(monitor.logs[0].datetime * 1000).toISOString()
        : null,
    })) as UptimeRobotRow[]
  }
}
