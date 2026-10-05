# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**project-excel-mcp** is an MCP (Model Context Protocol) server that collects data from multiple configurable sources (npm audit, SonarQube, Uptime Robot, Jira, HTTP APIs, local files) and exports them to Excel files, one sheet per source. It communicates via stdio transport.

## Common Commands

- `npm run build` — Compile TypeScript to `dist/`
- `npm run dev` — Run server in development with tsx
- `npm start` — Run compiled server
- `npm run start:fresh` — Build + start (recommended after code changes)
- `npm test` — Run tests with Vitest
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run tests/excelWriter.test.ts` — Run a single test file
- `npm run typecheck` — Type-check without emitting
- `npm run format` — Format with Prettier
- `npm run format:check` — Check formatting

## Architecture

The server follows a pipeline: **MCP tool handler -> data collector -> connector -> Excel writer**.

### Entry Point & Server Setup
- `src/index.ts` — Bootstraps the server, loads config, connects stdio transport
- `src/serverFactory.ts` — Registers all MCP tools on the `McpServer` instance with rate limiting

### Configuration Layer (`src/config/`)
- `loader.ts` — Reads `config.json` (path from `CONFIG_PATH` env var), validates with Zod, checks path safety
- `schema.ts` — Zod schemas and types for the config (`AppConfigOutput`, `ProjectConfigOutput`, `SourceConfigOutput`)
- Config can also come from `PROJECTS` env var (JSON array), which overrides `config.json` projects

### Connector Pattern (`src/connectors/`)
- `base.ts` — `Connector` interface with `collect(ctx: ConnectorContext): Promise<RowData[]>`
- `factory.ts` — Factory function mapping source `type` string to connector class
- Each connector (`httpConnector`, `fileConnector`, `npmAuditConnector`, `sonarQubeConnector`, `uptimeRobotConnector`, `jiraConnector`) implements `Connector`
- To add a new source: create connector, add type to `ALLOWED_SOURCE_TYPES` in `schema.ts`, register in `factory.ts`

### MCP Tools (`src/tools/`)
- `collectProject.ts` — Collects all enabled sources for a project
- `collectSource.ts` — Collects a single source
- `collectAllProjects.ts` — Collects all configured projects
- `getStatus.ts` / `validateConfig.ts` — Server status and config validation
- `fillQuality.ts` — Fills KPI quality tab with SonarQube metrics
- `handleBranchMismatch.ts` — Elicits user confirmation for branch switching
- `projectResolver.ts` — Resolves project config, supports dynamic projects from env

### Services (`src/services/`)
- `dataCollector.ts` — Orchestrates collecting sources for a project via connector factory
- `excelWriter.ts` — Creates/updates Excel workbooks with ExcelJS (one sheet per source, auto-formats headers)
- `branchManager.ts` — Git branch checking and switching logic
- `sanitizer.ts` — Data sanitization

### Utilities (`src/utils/`)
- `pathResolver.ts` — Path validation with traversal protection
- `logger.ts` — Pino logger with secret redaction
- `errors.ts` — Custom error classes (`McpAppError`, `BranchMismatchError`), `errorToToolResponse` helper
- `env.ts` — `getRequiredEnv()` helper
- `rateLimiter.ts` — In-memory rate limiter

## Key Conventions

- ESM modules (`"type": "module"` in package.json); all local imports use `.js` extension
- TypeScript strict mode, target ES2022, module NodeNext
- Credentials are ONLY in env vars, never in config files. Connectors use `apiKeyEnv`/`emailEnv`/`baseUrlEnv` fields that reference env var names
- Every successful tool response ends with `"Muchas gracias vuelva pronto"`
- `outputFile` and project paths are validated against path traversal
- Config files live in `config/`; `config/config.json` is gitignored (use example files as templates)
