import type { ToolResponse } from "../types.js"
import type {
  AppConfigOutput,
  ProjectConfigOutput,
  SourceConfigOutput,
} from "../config/schema.js"
import { collectProject as collectProjectData } from "../services/dataCollector.js"
import { writeResultsToExcel } from "../services/excelWriter.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError, McpAppError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { handleBranchMismatch } from "./handleBranchMismatch.js"
import { sanitizeObject } from "../services/sanitizer.js"
import {
  hasProjectsEnvOverride,
  resolveProjectFromEnv,
  resolveProjectsFromEnv,
} from "./projectResolver.js"

type CollectProjectArgs = {
  projectName: string
  projectPath?: string
  projectBranch?: string
  timeToCompare?: string
  outputFile?: string
}

function applySourceOverrides(
  source: SourceConfigOutput,
  args: CollectProjectArgs
): SourceConfigOutput {
  if (source.type !== "npm-audit") return source

  const updatedConfig: Record<string, unknown> = { ...source.config }

  if (args.projectPath) {
    updatedConfig.pathProject = args.projectPath
  }
  if (args.projectBranch) {
    updatedConfig.branch = args.projectBranch
  }
  if (args.timeToCompare) {
    updatedConfig.timeToCompare = args.timeToCompare
  }

  return {
    ...source,
    config: updatedConfig,
  }
}

function applyProjectOverrides(
  project: ProjectConfigOutput,
  args: CollectProjectArgs
): ProjectConfigOutput {
  if (!args.projectPath && !args.projectBranch && !args.timeToCompare) {
    return project
  }

  return {
    ...project,
    sources: project.sources.map((source) =>
      applySourceOverrides(source, args)
    ),
  }
}

function buildProjectForCollection(
  args: CollectProjectArgs,
  config: AppConfigOutput
): ProjectConfigOutput {
  if (hasProjectsEnvOverride()) {
    const envProject = resolveProjectFromEnv(args.projectName)
    if (envProject) {
      return applyProjectOverrides(envProject, args)
    }

    throw new McpAppError(
      `Project "${args.projectName}" not found in PROJECTS environment variable. Available projects: ${resolveProjectsFromEnv(
        []
      )
        .map((p) => p.name)
        .join(", ")}.`
    )
  }

  const existingProject = config.projects.find(
    (p) => p.name === args.projectName
  )

  if (existingProject) {
    return applyProjectOverrides(existingProject, args)
  }

  if (!args.projectPath) {
    throw new McpAppError(
      `Project "${args.projectName}" not found in configuration. Provide "projectPath" to analyze it dynamically.`
    )
  }

  return {
    name: args.projectName,
    sources: [
      {
        id: "vulnerabilities",
        sheetName: "Vulnerabilidades",
        type: "npm-audit",
        enabled: true,
        config: {
          pathProject: args.projectPath,
          branch: args.projectBranch || "main",
          timeToCompare: args.timeToCompare || "6 months",
        },
      },
    ],
  }
}

export async function collectProject(
  args: CollectProjectArgs,
  config: AppConfigOutput,
  ctx: { mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> } }
): Promise<ToolResponse> {
  let project: ProjectConfigOutput
  try {
    project = buildProjectForCollection(args, config)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(message),
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
