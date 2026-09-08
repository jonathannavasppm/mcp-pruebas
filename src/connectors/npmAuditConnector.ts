import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Connector, ConnectorContext } from "./base.js"
import type { DependencyRow, RowData } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { resolveValidatedPath } from "../utils/pathResolver.js"
import { BranchMismatchError, McpAppError } from "../utils/errors.js"
import { execAllowedCommand } from "../utils/exec.js"
import { logger } from "../utils/logger.js"

interface NpmAuditSourceConfig {
  pathProject: string
  branch: string
  timeToCompare?: string
}

interface NpmAuditOutput {
  vulnerabilities?: Record<string, unknown>
  metadata?: {
    vulnerabilities?: Record<string, number>
  }
}

interface NpmOutdatedOutput {
  [packageName: string]: {
    current?: string
    wanted?: string
    latest?: string
    dependent?: string
    location?: string
  }
}

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

interface PackageLock {
  lockfileVersion?: number
  packages?: Record<string, { version?: string }>
  dependencies?: Record<string, PackageLockEntry>
}

interface PackageLockEntry {
  version?: string
  dependencies?: Record<string, PackageLockEntry>
}

interface NpmRegistryTime {
  [version: string]: string
}

interface NpmRegistryPackage {
  time?: NpmRegistryTime
  deprecated?: boolean | string
}

export class NpmAuditConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as NpmAuditSourceConfig
    if (!cfg.pathProject || typeof cfg.pathProject !== "string") {
      throw new McpAppError(
        `npm-audit source "${source.id}" requires "pathProject" in config`
      )
    }
    if (!cfg.branch || typeof cfg.branch !== "string") {
      throw new McpAppError(
        `npm-audit source "${source.id}" requires "branch" in config`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as NpmAuditSourceConfig
    const projectPath = resolveValidatedPath(cfg.pathProject, {
      mustExist: false,
      allowAnyAbsolute: true,
    })

    if (!existsSync(join(projectPath, "package.json"))) {
      throw new McpAppError(
        `Project at "${cfg.pathProject}" does not contain a package.json file`
      )
    }

    if (!existsSync(join(projectPath, "package-lock.json"))) {
      throw new McpAppError(
        `Project at "${cfg.pathProject}" does not contain a package-lock.json file. Run "npm install" first.`
      )
    }

    await this.verifyBranch(projectPath, cfg.branch)

    logger.info(
      { sourceId: ctx.sourceId, projectPath },
      "Starting vulnerability analysis"
    )

    logger.info({ sourceId: ctx.sourceId, projectPath }, "Running npm audit")
    const auditResult = await this.runNpmAudit(projectPath)

    logger.info({ sourceId: ctx.sourceId, projectPath }, "Running npm outdated")
    const outdatedResult = await this.runNpmOutdated(projectPath)

    logger.info(
      { sourceId: ctx.sourceId, projectPath },
      "Reading package.json and installed versions"
    )
    const packageJson = this.readPackageJson(projectPath)
    const installedVersions = this.readInstalledVersions(projectPath)
    const vulnerablePackages = this.extractVulnerablePackages(auditResult)

    const packageNames = this.collectPackageNames(
      packageJson,
      outdatedResult,
      vulnerablePackages
    )

    logger.info(
      { sourceId: ctx.sourceId, packageCount: packageNames.length },
      "Fetching registry metadata for packages"
    )

    const rows: DependencyRow[] = []

    for (const packageName of packageNames) {
      logger.info({ sourceId: ctx.sourceId, packageName }, "Processing package")
      const row = await this.buildDependencyRow(
        packageName,
        packageJson,
        installedVersions,
        projectPath,
        outdatedResult[packageName],
        vulnerablePackages[packageName],
        cfg.timeToCompare || "6 months"
      )
      rows.push(row)
    }

    logger.info(
      { sourceId: ctx.sourceId, rowCount: rows.length },
      "Vulnerability analysis completed"
    )

    return rows
  }

  private async verifyBranch(
    projectPath: string,
    expectedBranch: string
  ): Promise<void> {
    const result = await execAllowedCommand(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: projectPath, timeout: 10_000 }
    )

    if (result.exitCode !== 0) {
      throw new McpAppError(
        `Unable to determine current git branch: ${result.stderr}`
      )
    }

    const currentBranch = result.stdout.trim()
    if (currentBranch !== expectedBranch) {
      throw new BranchMismatchError(
        `Project is currently on branch "${currentBranch}" but "${expectedBranch}" was configured.`,
        {
          projectPath,
          currentBranch,
          expectedBranch,
        }
      )
    }
  }

  private async runNpmAudit(projectPath: string): Promise<NpmAuditOutput> {
    const result = await execAllowedCommand(
      "npm",
      ["audit", "--json", "--audit-level=low"],
      { cwd: projectPath, timeout: 120_000 }
    )

    // npm audit returns exit code 1 when vulnerabilities are found
    if (result.exitCode !== 0 && result.stdout.trim() === "") {
      throw new McpAppError(
        `npm audit failed: ${result.stderr || "unknown error"}`
      )
    }

    try {
      return JSON.parse(result.stdout || "{}") as NpmAuditOutput
    } catch {
      throw new McpAppError("Unable to parse npm audit output as JSON")
    }
  }

  private async runNpmOutdated(
    projectPath: string
  ): Promise<NpmOutdatedOutput> {
    const result = await execAllowedCommand("npm", ["outdated", "--json"], {
      cwd: projectPath,
      timeout: 120_000,
    })

    // npm outdated returns exit code 1 when outdated packages exist
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new McpAppError(
        `npm outdated failed: ${result.stderr || "unknown error"}`
      )
    }

    try {
      return JSON.parse(result.stdout || "{}") as NpmOutdatedOutput
    } catch {
      return {}
    }
  }

  private readPackageJson(projectPath: string): PackageJson {
    const content = readFileSync(join(projectPath, "package.json"), "utf-8")
    return JSON.parse(content) as PackageJson
  }

  private readInstalledVersions(projectPath: string): Record<string, string> {
    const lockPath = join(projectPath, "package-lock.json")
    const versions: Record<string, string> = {}

    try {
      const content = readFileSync(lockPath, "utf-8")
      const lock = JSON.parse(content) as PackageLock

      if (lock.packages) {
        for (const [lockPathKey, pkg] of Object.entries(lock.packages)) {
          if (!lockPathKey.startsWith("node_modules/")) continue
          const packageName = lockPathKey.replace("node_modules/", "")
          if (pkg.version) {
            versions[packageName] = pkg.version
          }
        }
      }

      if (lock.dependencies) {
        this.extractVersionsFromLockDeps(lock.dependencies, versions)
      }
    } catch {
      // Fall back to reading node_modules if package-lock cannot be parsed
    }

    return versions
  }

  private readVersionFromNodeModules(
    projectPath: string,
    packageName: string
  ): string | null {
    try {
      const pkgPath = join(
        projectPath,
        "node_modules",
        packageName,
        "package.json"
      )
      const content = readFileSync(pkgPath, "utf-8")
      const pkg = JSON.parse(content) as { version?: string }
      return pkg.version || null
    } catch {
      return null
    }
  }

  private extractVersionsFromLockDeps(
    deps: Record<string, PackageLockEntry>,
    versions: Record<string, string>
  ): void {
    for (const [name, entry] of Object.entries(deps)) {
      if (entry.version && !versions[name]) {
        versions[name] = entry.version
      }
      if (entry.dependencies) {
        this.extractVersionsFromLockDeps(entry.dependencies, versions)
      }
    }
  }

  private collectPackageNames(
    packageJson: PackageJson,
    outdated: NpmOutdatedOutput,
    vulnerable: Record<string, unknown>
  ): string[] {
    const names = new Set<string>([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.optionalDependencies || {}),
      ...Object.keys(packageJson.peerDependencies || {}),
      ...Object.keys(outdated),
      ...Object.keys(vulnerable),
    ])
    return Array.from(names).sort()
  }

  private extractVulnerablePackages(
    audit: NpmAuditOutput
  ): Record<string, { severity?: string; via?: Array<{ url?: string }> }> {
    const result: Record<
      string,
      { severity?: string; via?: Array<{ url?: string }> }
    > = {}
    const vulnerabilities = audit.vulnerabilities || {}

    for (const [packageName, info] of Object.entries(vulnerabilities)) {
      if (typeof info !== "object" || info === null) continue
      const typed = info as {
        severity?: string
        via?: Array<{ url?: string } | string>
      }
      result[packageName] = {
        severity: typed.severity,
        via: typed.via
          ? typed.via.map((item) =>
              typeof item === "string" ? { url: item } : item
            )
          : [],
      }
    }

    return result
  }

  private async buildDependencyRow(
    packageName: string,
    packageJson: PackageJson,
    installedVersions: Record<string, string>,
    projectPath: string,
    outdated: NpmOutdatedOutput[string],
    vulnerability:
      { severity?: string; via?: Array<{ url?: string }> } | undefined,
    timeToCompare: string
  ): Promise<DependencyRow> {
    const currentVersion =
      outdated?.wanted ||
      outdated?.current ||
      installedVersions[packageName] ||
      this.readVersionFromNodeModules(projectPath, packageName) ||
      "unknown"
    const isTopLevel = this.isTopLevelDependency(packageName, packageJson)
    const hasVulnerability = vulnerability !== undefined

    const latestVersion =
      outdated?.latest ||
      (isTopLevel || hasVulnerability
        ? await this.fetchLatestVersion(packageName)
        : null)

    const dependencyType = this.getDependencyType(packageName, packageJson)

    const registryInfo = latestVersion
      ? await this.fetchRegistryInfo(packageName)
      : null

    const lastPublishedDate = latestVersion
      ? registryInfo?.time?.[latestVersion] || null
      : null

    const isDeprecated =
      typeof registryInfo?.deprecated === "string" ||
      registryInfo?.deprecated === true

    const severity = hasVulnerability
      ? vulnerability?.severity
        ? this.normalizeSeverity(vulnerability.severity)
        : "unknown"
      : null

    const maintenanceStatus = this.calculateMaintenanceStatus(
      latestVersion,
      currentVersion,
      isDeprecated,
      hasVulnerability,
      lastPublishedDate,
      timeToCompare
    )

    return {
      packageName,
      dependencyType,
      currentVersion,
      latestVersion,
      isUpToDate: latestVersion === null || currentVersion === latestVersion,
      isDeprecated,
      hasVulnerabilities: hasVulnerability,
      vulnerabilitySeverity: severity,
      lastPublishedDate,
      maintenanceStatus,
      advisoryUrl: vulnerability?.via?.[0]?.url || null,
    }
  }

  private getDependencyType(
    packageName: string,
    packageJson: PackageJson
  ): DependencyRow["dependencyType"] {
    if (packageJson.dependencies?.[packageName]) return "dependency"
    if (packageJson.devDependencies?.[packageName]) return "devDependency"
    if (packageJson.optionalDependencies?.[packageName])
      return "optionalDependency"
    if (packageJson.peerDependencies?.[packageName]) return "peerDependency"
    return "dependency"
  }

  private isTopLevelDependency(
    packageName: string,
    packageJson: PackageJson
  ): boolean {
    return (
      packageJson.dependencies?.[packageName] !== undefined ||
      packageJson.devDependencies?.[packageName] !== undefined ||
      packageJson.optionalDependencies?.[packageName] !== undefined ||
      packageJson.peerDependencies?.[packageName] !== undefined
    )
  }

  private async fetchLatestVersion(
    packageName: string
  ): Promise<string | null> {
    const registryInfo = await this.fetchRegistryInfo(packageName)
    if (!registryInfo?.time) return null

    const versionDates = Object.entries(registryInfo.time).filter(
      ([version]) => version !== "created" && version !== "modified"
    )

    if (versionDates.length === 0) return null

    versionDates.sort((a, b) => {
      const dateA = new Date(a[1]).getTime()
      const dateB = new Date(b[1]).getTime()
      return dateB - dateA
    })

    return versionDates[0][0]
  }

  private normalizeSeverity(
    severity: string
  ): DependencyRow["vulnerabilitySeverity"] {
    const normalized = severity.toLowerCase()
    if (["low", "moderate", "high", "critical"].includes(normalized)) {
      return normalized as DependencyRow["vulnerabilitySeverity"]
    }
    return null
  }

  private async fetchRegistryInfo(
    packageName: string
  ): Promise<NpmRegistryPackage | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        logger.warn(
          { packageName, status: response.status },
          "Failed to fetch npm registry info"
        )
        return null
      }

      return (await response.json()) as NpmRegistryPackage
    } catch (error) {
      logger.warn(
        { packageName, error: error instanceof Error ? error.message : error },
        "Error fetching npm registry info"
      )
      return null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private calculateMaintenanceStatus(
    latestVersion: string | null,
    currentVersion: string,
    isDeprecated: boolean,
    hasVulnerabilities: boolean,
    lastPublishedDate: string | null,
    timeToCompare: string
  ): DependencyRow["maintenanceStatus"] {
    if (isDeprecated) return "deprecated"
    if (hasVulnerabilities) return "outdated"
    if (latestVersion && currentVersion !== latestVersion) return "outdated"
    if (
      lastPublishedDate &&
      this.isOlderThan(lastPublishedDate, timeToCompare)
    ) {
      return "unmaintained"
    }
    return "ok"
  }

  private isOlderThan(dateString: string, timeToCompare: string): boolean {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return false

    const now = new Date()
    const months = this.parseMonths(timeToCompare)
    const threshold = new Date(now.setMonth(now.getMonth() - months))

    return date < threshold
  }

  private parseMonths(timeToCompare: string): number {
    const match = timeToCompare.match(/(\d+)\s*month/i)
    if (match) {
      return parseInt(match[1], 10)
    }
    return 6
  }
}
