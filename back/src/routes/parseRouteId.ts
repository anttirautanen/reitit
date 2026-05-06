export function parseRouteId(raw: string): number | null {
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}
