import type { ToolResponse } from "../types.js"

export class McpAppError extends Error {
  constructor(
    message: string,
    public readonly isUserFacing = true,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "McpAppError"
  }
}

export class BranchMismatchError extends McpAppError {
  constructor(
    message: string,
    public readonly payload: {
      projectPath: string
      currentBranch: string
      expectedBranch: string
    }
  ) {
    super(message, true, payload)
    this.name = "BranchMismatchError"
  }
}

export function errorToToolResponse(error: unknown): ToolResponse {
  if (error instanceof McpAppError) {
    return {
      content: [
        {
          type: "text",
          text: error.message,
        },
      ],
      isError: true,
    }
  }

  if (error instanceof Error) {
    return {
      content: [
        {
          type: "text",
          text: `Unexpected error: ${error.message}`,
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: "text",
        text: "An unknown error occurred",
      },
    ],
    isError: true,
  }
}
