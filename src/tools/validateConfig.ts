import type { ToolResponse } from "../types.js"
import type { AppConfigOutput } from "../config/schema.js"
import { appendFarewell } from "../utils/farewell.js"

export function validateConfig(_config: AppConfigOutput): ToolResponse {
  // Configuration is already validated during loadConfig()
  return {
    content: [
      {
        type: "text",
        text: appendFarewell(
          "Configuration is valid and all required environment variables are present."
        ),
      },
    ],
  }
}
