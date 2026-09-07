import type { Connector, ConnectorContext } from "./base.js"
import type { RowData } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { getRequiredEnv, getOptionalEnv } from "../utils/env.js"
import { McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

interface HttpFieldMapping {
  rowsPath?: string
  [key: string]: string | undefined
}

interface HttpSourceConfig {
  url: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  apiKeyEnv?: string
  apiKeyHeader?: string
  headers?: Record<string, string>
  fieldMapping: HttpFieldMapping
  body?: Record<string, unknown>
}

export class HttpConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as HttpSourceConfig
    if (!cfg.url || typeof cfg.url !== "string") {
      throw new McpAppError(
        `HTTP source "${source.id}" requires a valid "url" in config`
      )
    }
    if (!cfg.fieldMapping || typeof cfg.fieldMapping !== "object") {
      throw new McpAppError(
        `HTTP source "${source.id}" requires a valid "fieldMapping" in config`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as HttpSourceConfig
    const url = cfg.url
    const method = cfg.method || "GET"

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...cfg.headers,
    }

    if (cfg.apiKeyEnv && cfg.apiKeyHeader) {
      headers[cfg.apiKeyHeader] = getRequiredEnv(cfg.apiKeyEnv)
    } else if (cfg.apiKeyEnv) {
      headers.Authorization = `Bearer ${getRequiredEnv(cfg.apiKeyEnv)}`
    }

    logger.info(
      { sourceId: ctx.sourceId, projectName: ctx.projectName, url, method },
      "Fetching HTTP source"
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: cfg.body ? JSON.stringify(cfg.body) : undefined,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      throw new McpAppError(
        `HTTP source "${this.source.id}" returned status ${response.status}: ${response.statusText}`
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    const mapping = cfg.fieldMapping
    const rowsPath = mapping.rowsPath
    const rawRows = rowsPath ? getValueByPath(data, rowsPath.slice(2)) : [data]

    if (!Array.isArray(rawRows)) {
      throw new McpAppError(
        `HTTP source "${this.source.id}" did not return an array at path "${rowsPath ?? "root"}"`
      )
    }

    return rawRows.map((rawRow, index) =>
      this.mapRow(rawRow as Record<string, unknown>, mapping, index, url)
    )
  }

  private mapRow(
    rawRow: Record<string, unknown>,
    mapping: HttpFieldMapping,
    index: number,
    sourceUrl: string
  ): RowData {
    const row: RowData = {}

    for (const [column, path] of Object.entries(mapping)) {
      if (column === "rowsPath" || !path) continue
      const value = getValueByPath(rawRow, path.slice(2))
      row[column] = (value as string | number | boolean | null) ?? null
    }

    row.sourceUrl = sourceUrl
    row._index = index

    return row
  }
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\$\./, "").split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}
