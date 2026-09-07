import { StdioServerTransport } from "@modelcontextprotocol/server/stdio"
import { loadConfig } from "./config/loader.js"
import { createServer } from "./serverFactory.js"
import { logger } from "./utils/logger.js"

async function main(): Promise<void> {
  logger.info("Starting Project Excel MCP server...")

  const config = loadConfig()
  const server = createServer(config)
  const transport = new StdioServerTransport()

  await server.connect(transport)

  logger.info("MCP server connected via stdio")

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down MCP server...")
    await transport.close()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((error) => {
  logger.error({ error }, "Fatal error starting MCP server")
  process.stderr.write(
    `Fatal error: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
})
