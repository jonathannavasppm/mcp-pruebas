import { McpServer } from "@modelcontextprotocol/server"
import type { AppConfigOutput } from "./config/schema.js"
import { RateLimiter } from "./utils/rateLimiter.js"
import { logger } from "./utils/logger.js"
import { errorToToolResponse } from "./utils/errors.js"
import {
  COLLECT_PROJECT_TOOL,
  COLLECT_SOURCE_TOOL,
  COLLECT_ALL_PROJECTS_TOOL,
  GET_STATUS_TOOL,
  VALIDATE_CONFIG_TOOL,
  FILL_QUALITY_TOOL,
  collectProjectShape,
  collectSourceShape,
  collectAllProjectsShape,
  fillQualityShape,
  emptyShape,
} from "./tools/definitions.js"
import { collectProject } from "./tools/collectProject.js"
import { collectSource } from "./tools/collectSource.js"
import { collectAllProjects } from "./tools/collectAllProjects.js"
import { getStatus } from "./tools/getStatus.js"
import { validateConfig } from "./tools/validateConfig.js"
import { fillQuality } from "./tools/fillQuality.js"

const rateLimiter = new RateLimiter()

type ToolContext = {
  mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> }
}

function createToolContext(ctx: unknown): ToolContext {
  return ctx as ToolContext
}

export function createServer(config: AppConfigOutput): McpServer {
  const server = new McpServer({
    name: "project-excel-mcp",
    version: "1.0.0",
  })

  server.registerTool(
    COLLECT_PROJECT_TOOL,
    {
      description:
        "Collect all enabled data sources for a configured project and write them to an Excel file.",
      inputSchema: collectProjectShape,
    },
    async (args, ctx) => {
      try {
        rateLimiter.check(COLLECT_PROJECT_TOOL)
        return await collectProject(args, config, createToolContext(ctx))
      } catch (error) {
        logger.error({ error }, "collect_project failed")
        return errorToToolResponse(error)
      }
    }
  )

  server.registerTool(
    COLLECT_SOURCE_TOOL,
    {
      description:
        "Collect a single data source for a configured project and write it to an Excel file.",
      inputSchema: collectSourceShape,
    },
    async (args, ctx) => {
      try {
        rateLimiter.check(COLLECT_SOURCE_TOOL)
        return await collectSource(args, config, createToolContext(ctx))
      } catch (error) {
        logger.error({ error }, "collect_source failed")
        return errorToToolResponse(error)
      }
    }
  )

  server.registerTool(
    COLLECT_ALL_PROJECTS_TOOL,
    {
      description:
        "Collect all enabled sources for all configured projects and write them to an Excel file.",
      inputSchema: collectAllProjectsShape,
    },
    async (args, ctx) => {
      try {
        rateLimiter.check(COLLECT_ALL_PROJECTS_TOOL)
        return await collectAllProjects(args, config, createToolContext(ctx))
      } catch (error) {
        logger.error({ error }, "collect_all_projects failed")
        return errorToToolResponse(error)
      }
    }
  )

  server.registerTool(
    GET_STATUS_TOOL,
    {
      description:
        "Return the current server status, including configured projects and sources.",
      inputSchema: emptyShape,
    },
    async () => {
      try {
        rateLimiter.check(GET_STATUS_TOOL)
        return getStatus(config)
      } catch (error) {
        logger.error({ error }, "get_status failed")
        return errorToToolResponse(error)
      }
    }
  )

  server.registerTool(
    VALIDATE_CONFIG_TOOL,
    {
      description:
        "Validate that the configuration file and required environment variables are present.",
      inputSchema: emptyShape,
    },
    async () => {
      try {
        rateLimiter.check(VALIDATE_CONFIG_TOOL)
        return validateConfig(config)
      } catch (error) {
        logger.error({ error }, "validate_config failed")
        return errorToToolResponse(error)
      }
    }
  )

  server.registerTool(
    FILL_QUALITY_TOOL,
    {
      description:
        "Fill the KPI3 quality tab in a KPI Excel template with SonarQube metrics from one or more projects.",
      inputSchema: fillQualityShape,
    },
    async (args) => {
      try {
        rateLimiter.check(FILL_QUALITY_TOOL)
        return await fillQuality(args, config)
      } catch (error) {
        logger.error({ error }, "fill_quality failed")
        return errorToToolResponse(error)
      }
    }
  )

  return server
}
