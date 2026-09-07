import type { RateLimiterEntry } from "../types.js"
import { McpAppError } from "./errors.js"

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 100

export class RateLimiter {
  private readonly store = new Map<string, RateLimiterEntry>()

  constructor(
    private readonly maxRequests: number = DEFAULT_MAX_REQUESTS,
    private readonly windowMs: number = DEFAULT_WINDOW_MS
  ) {}

  check(key: string): void {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      })
      return
    }

    if (entry.count >= this.maxRequests) {
      throw new McpAppError(
        `Rate limit exceeded for "${key}". Try again in ${Math.ceil(
          (entry.resetTime - now) / 1000
        )} seconds.`
      )
    }

    entry.count += 1
  }
}
