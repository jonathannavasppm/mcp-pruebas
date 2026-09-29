import type { ToolResponse } from "../types.js"
import type { AppConfigOutput, SourceConfigOutput } from "../config/schema.js"
import { collectSource } from "../services/dataCollector.js"
import {
  mapSonarMetricsToQuality,
  writeQualityToTemplate,
} from "../services/templateWriter.js"
import type { QualityData } from "../services/templateWriter.js"
import { appendFarewell } from "../utils/farewell.js"
import { logger } from "../utils/logger.js"

const QUALITY_METRICS = [
  "alert_status",
  "sqale_rating",
  "sqale_debt_ratio",
  "coverage",
  "reliability_rating",
  "vulnerabilities",
]

interface RepoInput {
  projectKey: string
  baseUrl: string
  branch: string
  apiKeyEnv?: string
}

type FillQualityArgs = {
  templatePath: string
  repos: RepoInput[]
}

function buildSonarSource(repo: RepoInput): SourceConfigOutput {
  return {
    id: `sonar-${repo.projectKey}`,
    sheetName: `SonarQube-${repo.projectKey}`,
    type: "sonarqube",
    enabled: true,
    config: {
      baseUrl: repo.baseUrl,
      projectKey: repo.projectKey,
      branch: repo.branch,
      metrics: QUALITY_METRICS,
      ...(repo.apiKeyEnv ? { apiKeyEnv: repo.apiKeyEnv } : {}),
    },
  }
}

export async function fillQuality(
  args: FillQualityArgs,
  _config: AppConfigOutput
): Promise<ToolResponse> {
  const repos: QualityData[] = []
  const errors: string[] = []

  for (const repo of args.repos) {
    const source = buildSonarSource(repo)

    try {
      const rows = await collectSource(repo.projectKey, source)
      const metrics = rows.map((r) => ({
        metric: String(r.metric),
        value: r.value as string | number,
      }))

      const quality = mapSonarMetricsToQuality(
        metrics,
        repo.projectKey,
        repo.branch
      )
      repos.push(quality)

      logger.info(
        { projectKey: repo.projectKey, metricsCollected: metrics.length },
        "SonarQube metrics collected for quality template"
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error"
      errors.push(`Repo "${repo.projectKey}": ${message}`)
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
