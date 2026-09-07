import type { Connector } from "./base.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { HttpConnector } from "./httpConnector.js"
import { FileConnector } from "./fileConnector.js"
import { NpmAuditConnector } from "./npmAuditConnector.js"
import { SonarQubeConnector } from "./sonarQubeConnector.js"
import { UptimeRobotConnector } from "./uptimeRobotConnector.js"
import { JiraConnector } from "./jiraConnector.js"
import { McpAppError } from "../utils/errors.js"

export function createConnector(source: SourceConfigOutput): Connector {
  switch (source.type) {
    case "http":
      return new HttpConnector(source)
    case "file":
      return new FileConnector(source)
    case "npm-audit":
      return new NpmAuditConnector(source)
    case "sonarqube":
      return new SonarQubeConnector(source)
    case "uptime-robot":
      return new UptimeRobotConnector(source)
    case "jira":
      return new JiraConnector(source)
    default:
      throw new McpAppError(
        `Unsupported source type: "${(source as { type: string }).type}"`
      )
  }
}
