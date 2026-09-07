import pino from "pino"

const REDACTED_KEYS = [
  "apiKey",
  "api_key",
  "token",
  "auth",
  "authorization",
  "password",
  "secret",
  "privateKey",
  "credential",
  "email",
]

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        }
      : undefined,
  redact: {
    paths: REDACTED_KEYS,
    censor: "[REDACTED]",
  },
})
