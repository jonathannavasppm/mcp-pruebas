import { z } from "zod"

const ALLOWED_SOURCE_TYPES = [
  "http",
  "file",
  "npm-audit",
  "sonarqube",
  "uptime-robot",
  "jira",
] as const

const sourceTypeSchema = z
  .string()
  .refine(
    (value): value is (typeof ALLOWED_SOURCE_TYPES)[number] =>
      ALLOWED_SOURCE_TYPES.includes(
        value as (typeof ALLOWED_SOURCE_TYPES)[number]
      ),
    {
      message: `Source type must be one of: ${ALLOWED_SOURCE_TYPES.join(", ")}`,
    }
  )

const sourceConfigSchema = z.object({
  id: z.string().min(1),
  sheetName: z.string().min(1),
  type: sourceTypeSchema,
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
})

const projectConfigSchema = z.object({
  name: z.string().min(1),
  sources: z.array(sourceConfigSchema).min(1),
})

export const appConfigSchema = z.object({
  outputFile: z.string().min(1),
  projects: z.array(projectConfigSchema).min(1),
})

export type AppConfigInput = z.input<typeof appConfigSchema>
export type AppConfigOutput = z.output<typeof appConfigSchema>
export type SourceConfigInput = z.input<typeof sourceConfigSchema>
export type SourceConfigOutput = z.output<typeof sourceConfigSchema>
export type ProjectConfigInput = z.input<typeof projectConfigSchema>
export type ProjectConfigOutput = z.output<typeof projectConfigSchema>
