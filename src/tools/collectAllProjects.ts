import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { collectProject as collectProjectData } from "../services/dataCollector.js"
import { writeResultsToExcel } from "../services/excelWriter.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { handleBranchMismatch } from "./handleBranchMismatch.js"
import { sanitizeObject } from "../services/sanitizer.js"

export async function collectAllProjects(
  args: { outputFile?: string },
  config: AppConfigOutput,
  ctx: { mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> } }
): Promise<ToolResponse> {
  const outputFile = args.outputFile || config.outputFile
  const resolvedOutputFile = resolveValidatedPath(outputFile)

  const allResults: Awaited<ReturnType<typeof collectProjectData>>["results"] =
    []
  const allErrors: string[] = []

  for (const project of config.projects) {
    try {
      const result = await collectProjectData(project)
      allResults.push(...result.results)
      allErrors.push(...result.errors)
    } catch (error) {
      if (error instanceof BranchMismatchError) {
        return handleBranchMismatch(error, ctx)
      }
      const message = error instanceof Error ? error.message : "Unknown error"
      allErrors.push(`Project "${project.name}": ${message}`)
    }
  }

  if (allResults.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `No data was collected for any project. Errors:\n${allErrors.join("\n")}`
          ),
        },
      ],
      isError: true,
    }
  }

  const summary = await writeResultsToExcel(resolvedOutputFile, allResults)
  const sanitizedSummary = sanitizeObject(
    summary as unknown as Record<string, unknown>
  )

  const warnings =
    allErrors.length > 0 ? `\n\nWarnings:\n${allErrors.join("\n")}` : ""

  return {
    content: [
      {
        type: "text",
        text: appendFarewell(
          `All projects collected successfully.\n${JSON.stringify(
            sanitizedSummary,
            null,
            2
          )}${warnings}`
        ),
      },
    ],
  }
}
