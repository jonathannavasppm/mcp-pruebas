import { execAllowedCommand } from "../utils/exec.js"
import { logger } from "../utils/logger.js"
import { McpAppError } from "../utils/errors.js"

export interface BranchOperationResult {
  success: boolean
  message: string
}

export async function checkoutAndPull(
  projectPath: string,
  targetBranch: string
): Promise<BranchOperationResult> {
  logger.info(
    { projectPath, targetBranch },
    "Switching branch and pulling latest changes"
  )

  await runGitCommand(
    projectPath,
    ["fetch", "origin", targetBranch],
    `Failed to fetch branch "${targetBranch}"`
  )

  await runGitCommand(
    projectPath,
    ["checkout", targetBranch],
    `Failed to checkout branch "${targetBranch}"`
  )

  await runGitCommand(
    projectPath,
    ["pull", "origin", targetBranch],
    `Failed to pull latest changes for branch "${targetBranch}"`
  )

  return {
    success: true,
    message: `Successfully switched to branch "${targetBranch}" and pulled latest changes.`,
  }
}

async function runGitCommand(
  cwd: string,
  args: string[],
  errorMessage: string
): Promise<void> {
  const result = await execAllowedCommand("git", args, { cwd, timeout: 60_000 })
  if (result.exitCode !== 0) {
    throw new McpAppError(
      `${errorMessage}: ${result.stderr || result.stdout || "unknown error"}`
    )
  }
}
