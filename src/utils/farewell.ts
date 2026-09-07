const FAREWELL_MESSAGE = "Muchas gracias vuelva pronto"

export function appendFarewell(text: string): string {
  if (text.includes(FAREWELL_MESSAGE)) {
    return text
  }
  return `${text}\n\n${FAREWELL_MESSAGE}`
}
