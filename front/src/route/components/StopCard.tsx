import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react"
import type { ApiDeparture } from "@reitit/back/src/api"

// Placeholder colour heuristic until ApiStopLine.mode is plumbed through (Task 22).
// We default to blue and only special-case obvious gtfsId prefixes; this is intentionally
// conservative and will be replaced once mode metadata is available on the card.
const getPillColor = (lineGtfsId: string): string => {
  if (lineGtfsId.includes(":M:")) return "bg-orange-600 text-white"
  if (lineGtfsId.startsWith("HSL:300")) return "bg-purple-700 text-white"
  if (/^HSL:1\d{3}/.test(lineGtfsId)) return "bg-green-700 text-white"
  return "bg-blue-600 text-white"
}

export interface StopCardLine {
  gtfsId: string
  shortName: string | null
  departures: ApiDeparture[]
}

interface StopCardProps {
  stopName: string
  lines: StopCardLine[]
  /** Override "now" for tests. Production callers omit this. */
  now?: Date
  /** When provided, the card becomes activatable (click + keyboard). */
  onClick?: () => void
  /** When provided, renders a × in the corner that calls this on click. */
  onRemove?: () => void
}

function formatDepartureTime(iso: string, now: Date): string {
  const target = new Date(iso)
  const diffMs = target.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60 && diffMin >= 0) return `${String(diffMin)} min`
  // else HH:MM in user's locale, 24-hour
  return target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

const PLACEHOLDER = "…"

export const StopCard = ({ stopName, lines, now, onClick, onRemove }: StopCardProps) => {
  const nowDate = now ?? new Date()
  const isClickable = onClick !== undefined
  const handleKeyDown = isClickable
    ? (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }
    : undefined
  const handleRemoveMouseDown = onRemove
    ? (event: ReactMouseEvent<HTMLButtonElement>) => {
        // Prevent the underlying card from receiving the mousedown, which would
        // otherwise start a tap-to-edit interaction before the click handler fires.
        event.stopPropagation()
      }
    : undefined
  const handleRemoveClick = onRemove
    ? (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        event.preventDefault()
        onRemove()
      }
    : undefined
  return (
    <div
      className={`relative bg-white rounded-md shadow-md p-3 max-w-[220px]${isClickable ? " cursor-pointer" : ""}`}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove stop"
          className="absolute top-1 right-1 text-xs leading-none text-gray-500 hover:text-gray-800 cursor-pointer px-1 rounded"
          onMouseDown={handleRemoveMouseDown}
          onClick={handleRemoveClick}
        >
          ×
        </button>
      ) : null}
      <div className="text-sm font-bold text-black truncate">{stopName}</div>
      <div className="flex flex-col gap-1 mt-1">
        {lines.map((line) => {
          const label = line.shortName ?? line.gtfsId
          const nextText =
            line.departures.length > 0
              ? formatDepartureTime(line.departures[0].realtimeAt, nowDate)
              : PLACEHOLDER
          const followUpTexts = [1, 2].map((i) =>
            line.departures.length > i
              ? formatDepartureTime(line.departures[i].realtimeAt, nowDate)
              : PLACEHOLDER,
          )
          return (
            <div key={line.gtfsId} className="flex items-center gap-2 min-h-[1rem]">
              <span
                className={`inline-block rounded px-1 py-0 text-xs font-bold ${getPillColor(line.gtfsId)}`}
              >
                {label}
              </span>
              <span
                className="text-sm font-bold text-red-600"
                data-testid={`next-${line.gtfsId}`}
              >
                {nextText}
              </span>
              <span
                className="text-xs text-gray-600"
                data-testid={`followups-${line.gtfsId}`}
              >
                {followUpTexts.join(" · ")}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
