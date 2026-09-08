import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { rmSync, existsSync } from "node:fs"
import { writeResultsToExcel } from "../src/services/excelWriter.js"
import type { CollectedResult } from "../src/types.js"

const TEST_FILE = "./output/test-excel.xlsx"
const TEST_DIRECTORY = "./output/missing"
const NESTED_TEST_FILE = `${TEST_DIRECTORY}/nested/report.xlsx`

describe("excelWriter", () => {
  beforeEach(() => {
    if (existsSync(TEST_FILE)) {
      rmSync(TEST_FILE)
    }
    if (existsSync(TEST_DIRECTORY)) {
      rmSync(TEST_DIRECTORY, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      rmSync(TEST_FILE)
    }
    if (existsSync(TEST_DIRECTORY)) {
      rmSync(TEST_DIRECTORY, { recursive: true })
    }
  })

  it("writes a sheet with rows", async () => {
    const results: CollectedResult[] = [
      {
        sheetName: "SheetOne",
        rows: [
          { columnA: "value1", columnB: 123 },
          { columnA: "value2", columnB: 456 },
        ],
        errors: [],
      },
    ]

    const summary = await writeResultsToExcel(TEST_FILE, results)

    expect(summary.filePath).toContain("test-excel.xlsx")
    expect(summary.sheets).toHaveLength(1)
    expect(summary.sheets[0].name).toBe("SheetOne")
    expect(summary.sheets[0].rowCount).toBe(2)
    expect(existsSync(TEST_FILE)).toBe(true)
  })

  it("creates missing output directories", async () => {
    const results: CollectedResult[] = [
      {
        sheetName: "Vulnerabilities",
        rows: [{ packageName: "example-package" }],
        errors: [],
      },
    ]

    await writeResultsToExcel(NESTED_TEST_FILE, results)

    expect(existsSync(NESTED_TEST_FILE)).toBe(true)
  })

  it("skips empty sheets", async () => {
    const results: CollectedResult[] = [
      {
        sheetName: "EmptySheet",
        rows: [],
        errors: [],
      },
    ]

    const summary = await writeResultsToExcel(TEST_FILE, results)
    expect(summary.sheets).toHaveLength(0)
  })
})
