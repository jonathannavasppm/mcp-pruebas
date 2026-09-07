import { describe, it, expect } from "vitest"
import { resolveValidatedPath } from "../src/utils/pathResolver.js"

describe("pathResolver", () => {
  it("resolves a valid relative path", () => {
    const result = resolveValidatedPath("./output/report.xlsx")
    expect(result).toContain("/output/report.xlsx")
  })

  it("rejects absolute paths by default", () => {
    expect(() => resolveValidatedPath("/etc/passwd")).toThrow(
      "Absolute paths are not allowed"
    )
  })

  it("rejects path traversal attempts", () => {
    expect(() => resolveValidatedPath("../sensitive/file.txt")).toThrow(
      "Path traversal detected"
    )
  })

  it("allows absolute paths inside workspace when configured", () => {
    const result = resolveValidatedPath(`${process.cwd()}/output/report.xlsx`, {
      allowAbsolute: true,
    })
    expect(result).toContain("/output/report.xlsx")
  })

  it("allows any absolute path when allowAnyAbsolute is true", () => {
    const result = resolveValidatedPath("/tmp/mcp-test-project", {
      allowAnyAbsolute: true,
    })
    expect(result).toBe("/tmp/mcp-test-project")
  })

  it("rejects absolute paths with traversal even when allowAnyAbsolute is true", () => {
    expect(() =>
      resolveValidatedPath("/tmp/../etc/passwd", { allowAnyAbsolute: true })
    ).toThrow("Path traversal detected")
  })
})
