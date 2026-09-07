const PROMPT_INJECTION_PATTERNS = [
  /ignore previous instructions/gi,
  /disregard .* (instructions|prompt)/gi,
  /you are now/gi,
  /system prompt/gi,
  /\/\/ No Comment/gi,
]

export function sanitizeText(text: string): string {
  let result = text
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]")
  }
  return result
}

export function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeText(value)
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeValue(item)
    }
    return result
  }

  return value
}

export function sanitizeObject<T>(obj: T): T {
  return sanitizeValue(obj) as T
}
