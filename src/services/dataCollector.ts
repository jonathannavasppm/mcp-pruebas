import type { CollectedResult, RowData } from "../types.js"
import type {
  ProjectConfigOutput,
  SourceConfigOutput,
} from "../config/schema.js"
import { createConnector } from "../connectors/factory.js"
import { BranchMismatchError, McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

export interface CollectionSummary {
  projectName: string
  results: CollectedResult[]
  errors: string[]
}

export async function collectProject(
  project: ProjectConfigOutput
): Promise<CollectionSummary> {
  const results: CollectedResult[] = []
  const errors: string[] = []

  logger.info({ projectName: project.name }, "Collecting project data")

  for (const source of project.sources) {
    if (!source.enabled) {
      logger.info(
        { sourceId: source.id, projectName: project.name },
        "Skipping disabled source"
      )
      continue
    }

    try {
      const rows = await collectSource(project.name, source)
      results.push({
        sheetName: source.sheetName,
        rows,
        errors: [],
      })
    } catch (error) {
      if (error instanceof BranchMismatchError) {
        throw error
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(
        { sourceId: source.id, projectName: project.name, error: message },
        "Failed to collect source"
      )
      errors.push(`Source "${source.id}": ${message}`)
      results.push({
        sheetName: source.sheetName,
        rows: [],
        errors: [message],
      })
    }
  }

  return { projectName: project.name, results, errors }
}

export async function collectSource(
  projectName: string,
  source: SourceConfigOutput
): Promise<RowData[]> {
  const connector = createConnector(source)
  const rows = await connector.collect({
    sourceId: source.id,
    projectName,
  })
  logger.info(
    { sourceId: source.id, projectName, rowCount: rows.length },
    "Source collected successfully"
  )
  return rows
}
