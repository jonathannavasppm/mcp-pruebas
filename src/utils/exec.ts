import { spawn } from "node:child_process"
import { McpAppError } from "./errors.js"

const ALLOWED_COMMANDS = ["git", "npm"]

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function execAllowedCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<ExecResult> {
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new McpAppError(
      `Command "${command}" is not in the allowed command list.`
    )
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
    })

    let stdout = ""
    let stderr = ""

    const timeoutId = options.timeout
      ? setTimeout(() => {
          child.kill("SIGTERM")
          reject(
            new McpAppError(
              `Command "${command} ${args.join(" ")}" timed out after ${options.timeout}ms`
            )
          )
        }, options.timeout)
      : null

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8")
    })

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8")
    })

    child.on("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId)
      reject(
        new McpAppError(
          `Failed to execute "${command} ${args.join(" ")}": ${error.message}`
        )
      )
    })

    child.on("close", (exitCode) => {
      if (timeoutId) clearTimeout(timeoutId)
      resolve({ stdout, stderr, exitCode: exitCode ?? -1 })
    })
  })
}
