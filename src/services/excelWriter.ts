import { existsSync } from "node:fs"
import ExcelJS from "exceljs"
import type { CollectedResult, ExcelSummary, RowData } from "../types.js"
import { logger } from "../utils/logger.js"
import { McpAppError } from "../utils/errors.js"

export async function writeResultsToExcel(
  filePath: string,
  results: CollectedResult[]
): Promise<ExcelSummary> {
  const workbook = existsSync(filePath)
    ? await loadWorkbook(filePath)
    : new ExcelJS.Workbook()

  const sheets: ExcelSummary["sheets"] = []

  for (const result of results) {
    if (result.rows.length === 0) {
      logger.warn({ sheetName: result.sheetName }, "Skipping empty sheet")
      continue
    }

    const worksheet =
      workbook.getWorksheet(result.sheetName) ||
      workbook.addWorksheet(result.sheetName)
    worksheet.columns = buildColumns(result.rows)
    worksheet
      .getRows(1, worksheet.rowCount)
      ?.forEach((row) => row.eachCell((cell) => (cell.value = null)))

    // Clear existing rows
    let rowCount = worksheet.rowCount
    while (rowCount > 0) {
      worksheet.spliceRows(1, 1)
      rowCount -= 1
    }

    worksheet.columns = buildColumns(result.rows)

    for (const row of result.rows) {
      worksheet.addRow(row)
    }

    formatHeaderRow(worksheet)

    sheets.push({
      name: result.sheetName,
      rowCount: result.rows.length,
    })
  }

  try {
    await workbook.xlsx.writeFile(filePath)
  } catch (error) {
    throw new McpAppError(
      `Failed to write Excel file to "${filePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  }

  logger.info({ filePath, sheets }, "Excel file written successfully")

  return { filePath, sheets }
}

async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(filePath)
  } catch (error) {
    throw new McpAppError(
      `Failed to read existing Excel file "${filePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  }
  return workbook
}

function buildColumns(rows: RowData[]): Array<{ header: string; key: string }> {
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key !== "_index") {
        keys.add(key)
      }
    }
  }
  return Array.from(keys).map((key) => ({
    header: key,
    key,
  }))
}

function formatHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    }
  })
  headerRow.alignment = { vertical: "middle", horizontal: "center" }
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length },
  }
}
