import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  hasProjectsEnvOverride,
  resolveProjectFromEnv,
  resolveProjectsFromEnv,
} from "../src/tools/projectResolver.js"
import type { ProjectConfigOutput } from "../src/config/schema.js"

describe("projectResolver", () => {
  const originalEnv = process.env.PROJECTS

  beforeEach(() => {
    delete process.env.PROJECTS
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PROJECTS
    } else {
      process.env.PROJECTS = originalEnv
    }
  })

  it("returns config projects when PROJECTS is not set", () => {
    const configProjects: ProjectConfigOutput[] = [
      {
        name: "configured-project",
        sources: [],
      },
    ]

    const result = resolveProjectsFromEnv(configProjects)
    expect(result).toEqual(configProjects)
  })

  it("detects when PROJECTS env override is present", () => {
    process.env.PROJECTS = '[{"name":"app","path":"/workspace/app"}]'
    expect(hasProjectsEnvOverride()).toBe(true)
  })

  it("creates dynamic projects from PROJECTS env", () => {
    process.env.PROJECTS = JSON.stringify([
      { name: "app-one", path: "/workspace/app-one", branch: "develop" },
      {
        name: "app-two",
        path: "/workspace/app-two",
        timeToCompare: "3 months",
      },
    ])

    const result = resolveProjectsFromEnv([])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("app-one")
    expect(result[0].sources[0].sheetName).toBe("app-one - Vulnerabilidades")
    expect(result[0].sources[0].config).toEqual({
      pathProject: "/workspace/app-one",
      branch: "develop",
      timeToCompare: "6 months",
    })
    expect(result[1].sources[0].config).toEqual({
      pathProject: "/workspace/app-two",
      branch: "main",
      timeToCompare: "3 months",
    })
  })

  it("creates sonarqube, uptimeRobot and jira sources when configured", () => {
    process.env.PROJECTS = JSON.stringify([
      {
        name: "full-app",
        path: "/workspace/full-app",
        branch: "main",
        sonarqube: {
          enabled: true,
          baseUrl: "https://sonarqube.example.com",
          projectKey: "full-app-key",
          metrics: ["coverage", "bugs"],
        },
        uptimeRobot: {
          enabled: true,
          projectName: "Full App",
        },
        jira: {
          enabled: true,
          projectName: "FA",
          jql: "project = FA ORDER BY created DESC",
        },
      },
    ])

    const result = resolveProjectsFromEnv([])
    expect(result).toHaveLength(1)
    expect(result[0].sources).toHaveLength(4)

    const sonarqube = result[0].sources.find((s) => s.type === "sonarqube")
    expect(sonarqube).not.toBeUndefined()
    expect(sonarqube?.sheetName).toBe("full-app - SonarQube")
    expect(sonarqube?.config).toEqual({
      apiKeyEnv: "SONARQUBE_API_KEY",
      baseUrl: "https://sonarqube.example.com",
      projectKey: "full-app-key",
      branch: "main",
      metrics: ["coverage", "bugs"],
    })

    const uptimeRobot = result[0].sources.find((s) => s.type === "uptime-robot")
    expect(uptimeRobot?.config).toEqual({
      apiKeyEnv: "UPTIME_ROBOT_API_KEY",
      projectName: "Full App",
    })

    const jira = result[0].sources.find((s) => s.type === "jira")
    expect(jira?.config).toEqual({
      apiKeyEnv: "JIRA_API_TOKEN",
      emailEnv: "JIRA_EMAIL",
      baseUrlEnv: "JIRA_URL",
      projectName: "FA",
      jql: "project = FA ORDER BY created DESC",
    })
  })

  it("uses custom env var names when provided", () => {
    process.env.PROJECTS = JSON.stringify([
      {
        name: "multi-key-app",
        path: "/workspace/multi-key-app",
        sonarqube: {
          enabled: true,
          baseUrl: "https://sonarqube-1.example.com",
          apiKeyEnv: "SONARQUBE_API_KEY_APP1",
        },
        uptimeRobot: {
          enabled: true,
          projectName: "App 1",
          apiKeyEnv: "UPTIME_ROBOT_API_KEY_APP1",
        },
        jira: {
          enabled: true,
          projectName: "APP1",
          apiKeyEnv: "JIRA_API_TOKEN_APP1",
          emailEnv: "JIRA_EMAIL_APP1",
          baseUrlEnv: "JIRA_URL_APP1",
        },
      },
      {
        name: "default-key-app",
        path: "/workspace/default-key-app",
        sonarqube: {
          enabled: true,
          baseUrl: "https://sonarqube-2.example.com",
        },
      },
    ])

    const result = resolveProjectsFromEnv([])
    expect(result).toHaveLength(2)

    const customProject = result.find((p) => p.name === "multi-key-app")
    expect(customProject).not.toBeUndefined()

    const sonarqube = customProject?.sources.find((s) => s.type === "sonarqube")
    expect(sonarqube?.config).toEqual({
      apiKeyEnv: "SONARQUBE_API_KEY_APP1",
      baseUrl: "https://sonarqube-1.example.com",
      projectKey: "multi-key-app",
      branch: "main",
      metrics: ["coverage", "bugs", "vulnerabilities", "code_smells"],
    })

    const uptimeRobot = customProject?.sources.find(
      (s) => s.type === "uptime-robot"
    )
    expect(uptimeRobot?.config).toEqual({
      apiKeyEnv: "UPTIME_ROBOT_API_KEY_APP1",
      projectName: "App 1",
    })

    const jira = customProject?.sources.find((s) => s.type === "jira")
    expect(jira?.config).toEqual({
      apiKeyEnv: "JIRA_API_TOKEN_APP1",
      emailEnv: "JIRA_EMAIL_APP1",
      baseUrlEnv: "JIRA_URL_APP1",
      projectName: "APP1",
      jql: "project = 'APP1' AND status != Done ORDER BY created DESC",
    })

    const defaultProject = result.find((p) => p.name === "default-key-app")
    const defaultSonarqube = defaultProject?.sources.find(
      (s) => s.type === "sonarqube"
    )
    expect(defaultSonarqube?.config).toEqual({
      apiKeyEnv: "SONARQUBE_API_KEY",
      baseUrl: "https://sonarqube-2.example.com",
      projectKey: "default-key-app",
      branch: "main",
      metrics: ["coverage", "bugs", "vulnerabilities", "code_smells"],
    })
  })

  it("skips disabled sources", () => {
    process.env.PROJECTS = JSON.stringify([
      {
        name: "minimal-app",
        path: "/workspace/minimal-app",
        npmAudit: { enabled: false },
        sonarqube: { enabled: false },
      },
    ])

    const result = resolveProjectsFromEnv([])
    expect(result[0].sources).toHaveLength(0)
  })

  it("resolves a single project by name from env", () => {
    process.env.PROJECTS = JSON.stringify([
      { name: "target", path: "/workspace/target", branch: "main" },
    ])

    const result = resolveProjectFromEnv("target")
    expect(result).not.toBeUndefined()
    expect(result?.name).toBe("target")
    expect(result?.sources[0].config).toEqual({
      pathProject: "/workspace/target",
      branch: "main",
      timeToCompare: "6 months",
    })
  })

  it("returns undefined for unknown project from env", () => {
    process.env.PROJECTS = JSON.stringify([
      { name: "known", path: "/workspace/known" },
    ])

    const result = resolveProjectFromEnv("unknown")
    expect(result).toBeUndefined()
  })

  it("parses escaped JSON from PROJECTS", () => {
    process.env.PROJECTS =
      '[{\\"name\\":\\"escaped-app\\",\\"path\\":\\"/workspace/escaped-app\\"}]'

    const result = resolveProjectsFromEnv([])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("escaped-app")
  })

  it("ignores invalid PROJECTS entries", () => {
    process.env.PROJECTS = JSON.stringify([
      { name: "valid", path: "/workspace/valid" },
      { name: "", path: "/workspace/invalid" },
      { name: "missing-path" },
      "not-an-object",
    ])

    const result = resolveProjectsFromEnv([])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("valid")
  })
})
