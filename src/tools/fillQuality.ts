import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { collectSource } from "../services/dataCollector.js"
import {
  mapSonarMetricsToQuality,
  writeQualityToTemplate,
} from "../services/templateWriter.js"
import type { QualityData } from "../services/templateWriter.js"
import { McpAppError } from "../utils/errors.js"
import { appendFarewell } from "../utils/farewell.js"
import { logger } from "../utils/logger.js"
import {
  hasProjectsEnvOverride,
  resolveProjectFromEnv,
  resolveProjectsFromEnv,
} from "./projectResolver.js"

type FillQualityArgs = {
  templatePath: string
  projectNames: string[]
}

export async function fillQuality(
  args: FillQualityArgs,
  config: AppConfigOutput
): Promise<ToolResponse> {
  const repos: QualityData[] = []
  const errors: string[] = []

  for (const projectName of args.projectNames) {
    const project = hasProjectsEnvOverride()
      ? resolveProjectFromEnv(projectName)
      : config.projects.find((p) => p.name === projectName)

    if (!project) {
      errors.push(`Project "${projectName}" not found in configuration.`)
      continue
    }

    const sonarSource = project.sources.find(
      (s) => s.type === "sonarqube" && s.enabled
    )

    if (!sonarSource) {
      errors.push(
        `Project "${projectName}" has no enabled sonarqube source.`
      )
      continue
    }

    try {
      const rows = await collectSource(projectName, sonarSource)
      const metrics = rows.map((r) => ({
        metric: String(r.metric),
        value: r.value as string | number,
      }))

      const cfg = sonarSource.config as Record<string, unknown>
      const quality = mapSonarMetricsToQuality(
        metrics,
        String(cfg.projectKey ?? projectName),
        String(cfg.branch ?? "main")
      )

      repos.push(quality)

      logger.info(
        { projectName, metricsCollected: metrics.length },
        "SonarQube metrics collected for quality template"
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error"
      errors.push(`Project "${projectName}": ${message}`)
    }
  }

  if (repos.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `No quality data collected. Errors:\n${errors.join("\n")}`
          ),
        },
      ],
      isError: true,
    }
  }

  try {
    const filePath = await writeQualityToTemplate(args.templatePath, repos)

    const summary = {
      templatePath: filePath,
      reposWritten: repos.map((r) => r.projectKey),
      errors: errors.length > 0 ? errors : undefined,
    }

    const warnings =
      errors.length > 0 ? `\n\nWarnings:\n${errors.join("\n")}` : ""

    return {
      content: [
        {
          type: "text",
          text: appendFarewell(
            `Quality data written to template successfully.\n${JSON.stringify(
              summary,
              null,
              2
            )}${warnings}`
          ),
        },
      ],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      content: [
        {
          type: "text",
          text: appendFarewell(`Failed to write template: ${message}`),
        },
      ],
      isError: true,
    }
  }
}
