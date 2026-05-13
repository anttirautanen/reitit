import { useState } from "react"
import { useStopLinesQuery } from "../api"

interface LinePickerProps {
  stopId: string
  stopName: string
  mode: "add" | "edit"
  initialSelected: string[]
  onSave: (selectedGtfsIds: string[]) => Promise<void> | void
  onCancel: () => void
  saveError?: string | null
}

function getLinePillColor(mode: string): string {
  if (mode === "TRAM") return "bg-green-700 text-white"
  if (mode === "SUBWAY" || mode === "METRO") return "bg-orange-600 text-white"
  if (mode === "RAIL") return "bg-purple-700 text-white"
  return "bg-blue-600 text-white"
}

export const LinePicker = ({
  stopId,
  stopName,
  mode,
  initialSelected,
  onSave,
  onCancel,
  saveError,
}: LinePickerProps) => {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected))
  const [isSaving, setIsSaving] = useState(false)
  const linesQuery = useStopLinesQuery(stopId)

  const toggle = (gtfsId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(gtfsId)) {
        next.delete(gtfsId)
      } else {
        next.add(gtfsId)
      }
      return next
    })
  }

  const saveDisabled = isSaving || (mode === "add" && selected.size === 0)

  const handleSave = async () => {
    const ids = Array.from(selected)
    setIsSaving(true)
    try {
      await onSave(ids)
    } catch {
      // Parent surfaces failures via the `saveError` prop on the next render.
      // Keep the picker open with the current selection intact.
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-xl shadow-lg p-4 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-black truncate">{stopName}</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-600 px-2 py-1"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {linesQuery.isLoading ? (
          <div className="text-sm text-gray-600">Loading lines…</div>
        ) : linesQuery.isError ? (
          <div className="text-sm text-red-700">
            Failed to load lines for this stop. Close and try again.
          </div>
        ) : (
          (linesQuery.data?.lines ?? []).map((line) => {
            const isSelected = selected.has(line.gtfsId)
            return (
              <button
                key={line.gtfsId}
                type="button"
                aria-pressed={isSelected}
                data-selected={isSelected ? "true" : "false"}
                onClick={() => {
                  toggle(line.gtfsId)
                }}
                className="flex items-center justify-between w-full px-2 py-2 rounded hover:bg-gray-50"
              >
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${getLinePillColor(line.mode)}`}
                >
                  {line.shortName}
                </span>
                <span aria-hidden="true" className="text-sm text-green-700">
                  {isSelected ? "✓" : ""}
                </span>
              </button>
            )
          })
        )}
      </div>

      {saveError ? (
        <div className="bg-red-50 text-red-800 px-3 py-2 text-xs rounded mt-3">
          {saveError}
        </div>
      ) : null}

      <div className="flex justify-end mt-3">
        <button
          type="button"
          disabled={saveDisabled}
          onClick={() => {
            void handleSave()
          }}
          className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:bg-gray-300 disabled:text-gray-500"
        >
          Save
        </button>
      </div>
    </div>
  )
}
