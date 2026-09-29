import ExcelJS from "exceljs"
import { logger } from "../utils/logger.js"
import { McpAppError } from "../utils/errors.js"

const SHEET_NAME = "KPI3_CalidadCodigo"

const RATING_MAP: Record<string, string> = {
  "1.0": "A",
  "1": "A",
  "2.0": "B",
  "2": "B",
  "3.0": "C",
  "3": "C",
  "4.0": "D",
  "4": "D",
  "5.0": "E",
  "5": "E",
}

const QUALITY_GATE_MAP: Record<string, string> = {
  OK: "PASS",
  ERROR: "FAIL",
  WARN: "WARN",
}

export interface QualityData {
  projectKey: string
  branch: string
  analysisDate?: string
  qualityGate?: string
  maintainabilityRating?: string
  technicalDebtRatio?: string
  coverage?: string
  reliabilityRating?: string
  vulnerabilities?: string
}

export function mapSonarMetricsToQuality(
  metrics: Array<{ metric: string; value: string | number }>,
  projectKey: string,
  branch: string
): QualityData {
  const data: QualityData = { projectKey, branch }

  for (const m of metrics) {
    const val = String(m.value)
    switch (m.metric) {
      case "alert_status":
        data.qualityGate = QUALITY_GATE_MAP[val] ?? val
        break
      case "sqale_rating":
        data.maintainabilityRating = RATING_MAP[val] ?? val
        break
      case "sqale_debt_ratio":
        data.technicalDebtRatio = val
        break
      case "coverage":
        data.coverage = val
        break
      case "reliability_rating":
        data.reliabilityRating = RATING_MAP[val] ?? val
        break
      case "vulnerabilities":
        data.vulnerabilities = val
        break
    }
  }

  return data
}

export async function writeQualityToTemplate(
  templatePath: string,
  repos: QualityData[]
): Promise<string> {
  if (repos.length === 0) {
    throw new McpAppError("No quality data to write")
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(templatePath)
  } catch (error) {
    throw new McpAppError(
      `Failed to read template "${templatePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  }

  const ws = workbook.getWorksheet(SHEET_NAME)
  if (!ws) {
    throw new McpAppError(
      `Sheet "${SHEET_NAME}" not found in template "${templatePath}"`
    )
  }

  for (let i = 0; i < repos.length; i++) {
    const col = 2 + i // B=2, C=3, D=4...
    const repo = repos[i]

    setCellValue(ws, 4, col, repo.projectKey)
    setCellValue(ws, 5, col, repo.branch)
    if (repo.analysisDate) {
      setCellValue(ws, 6, col, new Date(repo.analysisDate))
    }
    if (repo.qualityGate) {
      setCellValue(ws, 10, col, repo.qualityGate)
    }
    if (repo.maintainabilityRating) {
      setCellValue(ws, 11, col, repo.maintainabilityRating)
    }
    if (repo.technicalDebtRatio) {
      setCellValue(ws, 12, col, parseFloat(repo.technicalDebtRatio) / 100)
    }
    if (repo.coverage) {
      setCellValue(ws, 13, col, parseFloat(repo.coverage) / 100)
    }
    if (repo.reliabilityRating) {
      setCellValue(ws, 14, col, repo.reliabilityRating)
    }
    // Row 15 is a formula — skip
    if (repo.vulnerabilities) {
      setCellValue(ws, 16, col, parseInt(repo.vulnerabilities, 10))
    }
    // Row 20 is a formula — skip
  }

  try {
    await workbook.xlsx.writeFile(templatePath)
  } catch (error) {
    throw new McpAppError(
      `Failed to write template "${templatePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  }

  logger.info(
    { templatePath, repoCount: repos.length },
    "Quality data written to template"
  )

  return templatePath
}

function setCellValue(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number | Date
): void {
  const cell = ws.getCell(row, col)
  // Preserve formulas — only write if cell is not a formula
  if (cell.value && typeof cell.value === "object" && "formula" in cell.value) {
    return
  }
  cell.value = value
}
