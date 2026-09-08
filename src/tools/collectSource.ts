import type { ToolResponse } from "../types.js"
import type {
  AppConfigOutput,
  ProjectConfigOutput,
  SourceConfigOutput,
} from "../config/schema.js"
import { collectSource as collectSingleSource } from "../services/dataCollector.js"
import { writeResultsToExcel } from "../services/excelWriter.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { handleBranchMismatch } from "./handleBranchMismatch.js"
import { sanitizeObject } from "../services/sanitizer.js"
import {
  hasProjectsEnvOverride,
  resolveProjectFromEnv,
} from "./projectResolver.js"

type CollectSourceArgs = {
  projectName: string
  sourceId: string
  projectPath?: string
  projectBranch?: string
  timeToCompare?: string
  outputFile?: string
}

function applySourceOverrides(
  source: SourceConfigOutput,
  args: CollectSourceArgs
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
  args: CollectSourceArgs
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

function resolveProject(
  args: CollectSourceArgs,
  config: AppConfigOutput
): ProjectConfigOutput | null {
  if (hasProjectsEnvOverride()) {
    return resolveProjectFromEnv(args.projectName) || null
  }

  return config.projects.find((p) => p.name === args.projectName) || null
}

export async function collectSource(
  args: CollectSourceArgs,
  config: AppConfigOutput,
  ctx: { mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> } }
): Promise<ToolResponse> {
  const project = resolveProject(args, config)
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

  const projectWithOverrides = applyProjectOverrides(project, args)
  const overriddenSource = projectWithOverrides.sources.find(
    (s) => s.id === args.sourceId
  )
  if (!overriddenSource) {
    throw new Error("Source disappeared after applying overrides")
  }

  const outputFile = args.outputFile || config.outputFile
  const resolvedOutputFile = resolveValidatedPath(outputFile)

  let rows
  try {
    rows = await collectSingleSource(
      projectWithOverrides.name,
      overriddenSource
    )
  } catch (error) {
    if (error instanceof BranchMismatchError) {
      return handleBranchMismatch(error, ctx)
    }
    throw error
  }

  const summary = await writeResultsToExcel(resolvedOutputFile, [
    { sheetName: overriddenSource.sheetName, rows, errors: [] },
  ])

  const sanitizedSummary = sanitizeObject(
    summary as unknown as Record<string, unknown>
  )

  return {
    content: [
      {
        type: "text",
        text: appendFarewell(
          `Source "${overriddenSource.id}" collected successfully.\n${JSON.stringify(
            sanitizedSummary,
            null,
            2
          )}`
        ),
      },
    ],
  }
}
