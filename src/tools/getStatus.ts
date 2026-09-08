import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { appendFarewell } from "../utils/farewell.js"
import { resolveProjectsFromEnv } from "./projectResolver.js"

export function getStatus(config: AppConfigOutput): ToolResponse {
  const projects = resolveProjectsFromEnv(config.projects).map((project) => ({
    name: project.name,
    sources: project.sources.map((source) => ({
      id: source.id,
      type: source.type,
      sheetName: source.sheetName,
      enabled: source.enabled,
    })),
  }))

  const text = JSON.stringify(
    {
      outputFile: config.outputFile,
      projects,
    },
    null,
    2
  )

  return {
    content: [
      {
        type: "text",
        text: appendFarewell(`Server status:\n${text}`),
      },
    ],
  }
}
