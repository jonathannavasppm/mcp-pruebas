import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { appendFarewell } from "../utils/farewell.js"

export function getStatus(config: AppConfigOutput): ToolResponse {
  const projects = config.projects.map((project) => ({
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
