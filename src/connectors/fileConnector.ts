import { readFileSync } from "node:fs"
import type { Connector, ConnectorContext } from "./base.js"
import type { RowData } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { McpAppError } from "../utils/errors.js"

interface FileSourceConfig {
  path: string
  format: "json" | "csv"
  rowsPath?: string
  delimiter?: string
}

export class FileConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as FileSourceConfig
    if (!cfg.path || typeof cfg.path !== "string") {
      throw new McpAppError(
        `File source "${source.id}" requires a valid "path" in config`
      )
    }
    if (!["json", "csv"].includes(cfg.format)) {
      throw new McpAppError(
        `File source "${source.id}" requires "format" to be "json" or "csv"`
      )
    }
  }

  async collect(_ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as FileSourceConfig
    const absolutePath = resolveValidatedPath(cfg.path, { mustExist: false })

    let content: string
    try {
      content = readFileSync(absolutePath, "utf-8")
    } catch (error) {
      throw new McpAppError(
        `Unable to read file "${cfg.path}": ${
          error instanceof Error ? error.message : "unknown error"
        }`
      )
    }

    if (cfg.format === "json") {
      return this.parseJson(content, cfg.rowsPath)
    }

    return this.parseCsv(content, cfg.delimiter || ",")
  }

  private parseJson(content: string, rowsPath?: string): RowData[] {
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch {
      throw new McpAppError(
        `File source "${this.source.id}" contains invalid JSON`
      )
    }

    const rows = rowsPath
      ? getValueByPath(data as Record<string, unknown>, rowsPath)
      : data

    if (!Array.isArray(rows)) {
      throw new McpAppError(
        `File source "${this.source.id}" did not resolve to an array of rows`
      )
    }

    return rows as RowData[]
  }

  private parseCsv(content: string, delimiter: string): RowData[] {
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) return []

    const headers = lines[0].split(delimiter).map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = line.split(delimiter)
      const row: RowData = {}
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() ?? null
      })
      return row
    })
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
