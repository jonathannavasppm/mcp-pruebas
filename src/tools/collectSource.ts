import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { collectSource as collectSingleSource } from "../services/dataCollector.js"
import { writeResultsToExcel } from "../services/excelWriter.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { handleBranchMismatch } from "./handleBranchMismatch.js"
import { sanitizeObject } from "../services/sanitizer.js"

export async function collectSource(
  args: { projectName: string; sourceId: string; outputFile?: string },
  config: AppConfigOutput,
  ctx: { mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> } }
): Promise<ToolResponse> {
  const project = config.projects.find((p) => p.name === args.projectName)
  if (!project) {
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `Project "${args.projectName}" not found in configuration.`
          ),
        },
      ],
      isError: true,
    }
  }

  const source = project.sources.find((s) => s.id === args.sourceId)
  if (!source) {
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `Source "${args.sourceId}" not found in project "${args.projectName}".`
          ),
        },
      ],
      isError: true,
    }
  }

  const outputFile = args.outputFile || config.outputFile
  const resolvedOutputFile = resolveValidatedPath(outputFile)

  let rows
  try {
    rows = await collectSingleSource(project.name, source)
  } catch (error) {
    if (error instanceof BranchMismatchError) {
      return handleBranchMismatch(error, ctx)
    }
    throw error
  }

  const summary = await writeResultsToExcel(resolvedOutputFile, [
    { sheetName: source.sheetName, rows, errors: [] },
  ])

  const sanitizedSummary = sanitizeObject(
    summary as unknown as Record<string, unknown>
  )

  return {
    content: [
      {
        type: "text",
        text: appendFarewell(
          `Source "${source.id}" collected successfully.\n${JSON.stringify(
            sanitizedSummary,
            null,
            2
          )}`
        ),
      },
    ],
  }
}
