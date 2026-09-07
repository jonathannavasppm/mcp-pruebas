import { McpAppError } from "./errors.js"

export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new McpAppError(
      `Missing required environment variable: ${name}. Please configure it in your MCP client settings.`
    )
  }
  return value
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name]
}
