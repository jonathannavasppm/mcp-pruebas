import { z } from "zod"

export const collectProjectShape = {
  projectName: z
    .string()
    .min(1)
    .describe("Name of the project configured in config.json"),
  outputFile: z
    .string()
    .optional()
    .describe("Optional override for the Excel output file path"),
}

export const collectSourceShape = {
  projectName: z
    .string()
    .min(1)
    .describe("Name of the project configured in config.json"),
  sourceId: z.string().min(1).describe("ID of the source to collect"),
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

export const emptyShape = {}

export const COLLECT_PROJECT_TOOL = "collect_project"
export const COLLECT_SOURCE_TOOL = "collect_source"
export const COLLECT_ALL_PROJECTS_TOOL = "collect_all_projects"
export const GET_STATUS_TOOL = "get_status"
export const VALIDATE_CONFIG_TOOL = "validate_config"
