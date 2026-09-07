import { realpathSync } from "node:fs"
import { resolve, relative, isAbsolute, normalize } from "node:path"
import { McpAppError } from "./errors.js"

const WORKSPACE_ROOT = process.cwd()

export function getWorkspaceRoot(): string {
  return realpathSync(WORKSPACE_ROOT)
}

export function resolveValidatedPath(
  inputPath: string,
  options: {
    mustExist?: boolean
    allowAbsolute?: boolean
    allowAnyAbsolute?: boolean
  } = {}
): string {
  const { allowAbsolute = false, allowAnyAbsolute = false } = options

  if (!inputPath || typeof inputPath !== "string") {
    throw new McpAppError("Path is required and must be a string")
  }

  if (inputPath.includes("\0")) {
    throw new McpAppError("Path contains invalid characters")
  }

  const inputParts = inputPath.split("/")
  if (inputParts.includes("..")) {
    throw new McpAppError(
      "Path traversal detected. The path cannot contain parent directory references."
    )
  }

  const normalizedInput = normalize(inputPath)

  if (isAbsolute(normalizedInput)) {
    if (!allowAbsolute && !allowAnyAbsolute) {
      throw new McpAppError(
        "Absolute paths are not allowed. Use a relative path within the workspace."
      )
    }

    if (allowAnyAbsolute) {
      const realResolved = safeRealpath(normalizedInput)
      return normalize(realResolved)
    }
  }

  const workspaceRoot = getWorkspaceRoot()
  const resolved = resolve(workspaceRoot, normalizedInput)
  const realResolved = safeRealpath(resolved)
  const realWorkspaceRoot = getWorkspaceRoot()

  const rel = relative(realWorkspaceRoot, realResolved)

  if (rel.startsWith("..") || rel === "") {
    throw new McpAppError(
      "Path traversal detected. The path must be inside the workspace."
    )
  }

  return realResolved
}

function safeRealpath(targetPath: string): string {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}
