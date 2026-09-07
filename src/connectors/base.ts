import type { RowData } from "../types.js"

export interface ConnectorContext {
  sourceId: string
  projectName: string
}

export interface Connector {
  collect(ctx: ConnectorContext): Promise<RowData[]>
}
