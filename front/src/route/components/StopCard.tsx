// Placeholder colour heuristic until ApiStopLine.mode is plumbed through (Task 22).
// We default to blue and only special-case obvious gtfsId prefixes; this is intentionally
// conservative and will be replaced once mode metadata is available on the card.
const getPillColor = (lineGtfsId: string): string => {
  if (lineGtfsId.includes(":M:")) return "bg-orange-600 text-white"
  if (lineGtfsId.startsWith("HSL:300")) return "bg-purple-700 text-white"
  if (/^HSL:1\d{3}/.test(lineGtfsId)) return "bg-green-700 text-white"
  return "bg-blue-600 text-white"
}

interface StopCardProps {
  stopName: string
  lines: string[]
}

export const StopCard = ({ stopName, lines }: StopCardProps) => {
  return (
    <div className="bg-white rounded-md shadow-md p-3 max-w-[180px]">
      <div className="text-sm font-bold text-black truncate">{stopName}</div>
      <div className="flex flex-col gap-1 mt-1">
        {lines.map((line) => (
          <span
            key={line}
            className={`inline-block rounded px-1 py-0 text-xs font-bold ${getPillColor(line)}`}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}
