import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadDotenv } from "dotenv"
import { logger } from "../utils/logger.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { McpAppError } from "../utils/errors.js"
import { appConfigSchema, type AppConfigOutput } from "./schema.js"

export function loadConfig(): AppConfigOutput {
  loadDotenv({ path: resolve(process.cwd(), ".env") })

  const configPath = process.env.CONFIG_PATH || "./config/config.json"
  const absolutePath = resolve(process.cwd(), configPath)

  let raw: string
  try {
    raw = readFileSync(absolutePath, "utf-8")
  } catch (error) {
    throw new McpAppError(
      `Unable to read config file at "${configPath}". Please create it from config/config.example.json.`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new McpAppError(`Config file at "${configPath}" is not valid JSON.`)
  }

  const result = appConfigSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new McpAppError(`Invalid config.json:\n${issues}`)
  }

  const validatedConfig = result.data

  // Validate outputFile stays inside workspace
  resolveValidatedPath(validatedConfig.outputFile, { allowAbsolute: false })

  logger.info({ configPath }, "Configuration loaded successfully")

  return validatedConfig
}
