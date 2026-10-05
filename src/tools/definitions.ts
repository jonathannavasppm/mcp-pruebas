import { z } from "zod"

export const collectProjectShape = {
  projectName: z.string().min(1).describe("Name of the project to analyze"),
  projectPath: z
    .string()
    .optional()
    .describe(
      "Optional override for the project path. Required if the project is not configured in config.json"
    ),
  projectBranch: z
    .string()
    .optional()
    .describe("Optional override for the Git branch to validate"),
  timeToCompare: z
    .string()
    .optional()
    .describe(
      "Optional override for the maintenance comparison window (e.g. '6 months')"
    ),
  outputFile: z
    .string()
    .optional()
    .describe("Optional override for the Excel output file path"),
}

export const collectSourceShape = {
  projectName: z.string().min(1).describe("Name of the project to analyze"),
  sourceId: z.string().min(1).describe("ID of the source to collect"),
  projectPath: z
    .string()
    .optional()
    .describe("Optional override for the project path"),
  projectBranch: z
    .string()
    .optional()
    .describe("Optional override for the Git branch to validate"),
  timeToCompare: z
    .string()
    .optional()
    .describe(
      "Optional override for the maintenance comparison window (e.g. '6 months')"
    ),
  outputFile: z
    .string()
    .optional()
    .describe("Optional override for output path"),
}

export const collectAllProjectsShape = {
  outputFile: z
    .string()
    .optional()
    .describe("Optional override for output path"),
}

const sonarRepoSchema = z.object({
  projectKey: z.string().min(1).describe("SonarQube project key"),
  baseUrl: z.string().min(1).describe("SonarQube base URL"),
  branch: z.string().min(1).describe("Branch to analyze"),
  apiKeyEnv: z
    .string()
    .optional()
    .describe(
      "Environment variable name for the API key (defaults to SONARQUBE_API_KEY)"
    ),
})

export const fillQualityShape = {
  templatePath: z
    .string()
    .min(1)
    .describe("Absolute path to the KPI Excel template to fill"),
  repos: z
    .array(sonarRepoSchema)
    .min(1)
    .describe(
      "List of SonarQube repos to analyze. Each repo fills one column (B, C, D...) in the quality tab"
    ),
}

export const emptyShape = {}

export const COLLECT_PROJECT_TOOL = "collect_project"
export const COLLECT_SOURCE_TOOL = "collect_source"
export const COLLECT_ALL_PROJECTS_TOOL = "collect_all_projects"
export const GET_STATUS_TOOL = "get_status"
export const VALIDATE_CONFIG_TOOL = "validate_config"
export const FILL_QUALITY_TOOL = "fill_quality"
