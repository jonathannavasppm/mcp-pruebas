import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { collectProject as collectProjectData } from "../services/dataCollector.js"
import { writeResultsToExcel } from "../services/excelWriter.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { handleBranchMismatch } from "./handleBranchMismatch.js"
import { sanitizeObject } from "../services/sanitizer.js"

export async function collectProject(
  args: { projectName: string; outputFile?: string },
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

  const outputFile = args.outputFile || config.outputFile
  const resolvedOutputFile = resolveValidatedPath(outputFile)

  let collectionResult
  try {
    collectionResult = await collectProjectData(project)
  } catch (error) {
    if (error instanceof BranchMismatchError) {
      return handleBranchMismatch(error, ctx)
    }
    throw error
  }

  if (
    collectionResult.results.length === 0 &&
    collectionResult.errors.length > 0
  ) {
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `No data was collected for project "${args.projectName}". Errors:\n${collectionResult.errors.join("\n")}`
          ),
        },
      ],
      isError: true,
    }
  }

  const summary = await writeResultsToExcel(
    resolvedOutputFile,
    collectionResult.results
  )

  const sanitizedSummary = sanitizeObject(
    summary as unknown as Record<string, unknown>
  )
  const summaryText = JSON.stringify(sanitizedSummary, null, 2)

  const warnings =
    collectionResult.errors.length > 0
      ? `\n\nWarnings:\n${collectionResult.errors.join("\n")}`
      : ""

  return {
    content: [
      {
        type: "text",
        text: appendFarewell(
          `Project "${args.projectName}" collected successfully.\n${summaryText}${warnings}`
        ),
      },
    ],
  }
}
