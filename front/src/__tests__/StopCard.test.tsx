import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ApiDeparture } from "@reitit/back/src/api"
import { StopCard, type StopCardLine } from "../route/components/StopCard"

function dep(iso: string): ApiDeparture {
  return { scheduledAt: iso, realtimeAt: iso, isRealtime: true, headsign: "Test" }
}

function line(
  gtfsId: string,
  shortName: string | null,
  departures: ApiDeparture[],
): StopCardLine {
  return { gtfsId, shortName, departures }
}

describe("StopCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the stop name", () => {
    render(<StopCard stopName="Rautatientori" lines={[line("HSL:1071", "71", [])]} />)
    expect(screen.getByText("Rautatientori")).toBeInTheDocument()
  })

  it("renders one pill per line, each containing the line shortName", () => {
    const lines: StopCardLine[] = [
      line("HSL:1071", "71", []),
      line("HSL:1095", "95", []),
      line("HSL:9", "9", []),
    ]
    render(<StopCard stopName="Test stop" lines={lines} />)
    for (const l of lines) {
      const label = l.shortName ?? l.gtfsId
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("falls back to the blue pill class for an unknown gtfsId", () => {
    render(<StopCard stopName="Test stop" lines={[line("unknown-line-id", null, [])]} />)
    const pill = screen.getByText("unknown-line-id")
    expect(pill.className).toContain("bg-blue-600")
    expect(pill.className).toContain("text-white")
  })

  it("renders next departure plus two follow-ups within the hour", () => {
    const now = new Date("2026-04-28T12:00:00Z")
    const departures = [
      dep("2026-04-28T12:05:00Z"),
      dep("2026-04-28T12:15:00Z"),
      dep("2026-04-28T12:25:00Z"),
    ]
    render(
      <StopCard
        stopName="Test"
        lines={[line("HSL:1071", "71", departures)]}
        now={now}
      />,
    )
    const next = screen.getByTestId("next-HSL:1071")
    const followups = screen.getByTestId("followups-HSL:1071")
    expect(next.textContent).toBe("5 min")
    expect(followups.textContent).toContain("15 min")
    expect(followups.textContent).toContain("25 min")
    // Next is red (different colour class), follow-ups are gray.
    expect(next.className).toContain("text-red-600")
    expect(followups.className).toContain("text-gray-600")
    expect(next.className).not.toContain("text-gray-600")
  })

  it("renders HH:MM for departures beyond the hour", () => {
    const now = new Date("2026-04-28T07:00:00Z")
    // 90 minutes later — must render as HH:MM, not "90 min".
    const target = new Date(now.getTime() + 90 * 60_000)
    const expected = target.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    render(
      <StopCard
        stopName="Test"
        lines={[line("HSL:1071", "71", [dep(target.toISOString())])]}
        now={now}
      />,
    )
    const next = screen.getByTestId("next-HSL:1071")
    expect(next.textContent).toBe(expected)
    expect(next.textContent).not.toContain("min")
  })

  it("renders HH:MM (not a negative number) for departures in the past", () => {
    const now = new Date("2026-04-28T12:00:00Z")
    const target = new Date(now.getTime() - 5 * 60_000)
    const expected = target.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    render(
      <StopCard
        stopName="Test"
        lines={[line("HSL:1071", "71", [dep(target.toISOString())])]}
        now={now}
      />,
    )
    const next = screen.getByTestId("next-HSL:1071")
    expect(next.textContent).toBe(expected)
    expect(next.textContent).not.toContain("-")
    expect(next.textContent).not.toContain("min")
  })

  it("does not expose a button role when onClick is omitted", () => {
    render(<StopCard stopName="Test stop" lines={[line("HSL:1071", "71", [])]} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("fires onClick on click and on Enter/Space key presses when clickable", () => {
    const onClick = vi.fn()
    render(
      <StopCard
        stopName="Test stop"
        lines={[line("HSL:1071", "71", [])]}
        onClick={onClick}
      />,
    )
    const card = screen.getByRole("button", { name: /test stop/i })
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: "Enter" })
    fireEvent.keyDown(card, { key: " " })
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it("renders placeholder dots when a line has no departures yet", () => {
    render(
      <StopCard stopName="Test" lines={[line("HSL:1071", "71", [])]} now={new Date()} />,
    )
    const next = screen.getByTestId("next-HSL:1071")
    const followups = screen.getByTestId("followups-HSL:1071")
    expect(next.textContent).toBe("…")
    expect(followups.textContent).toBe("… · …")
  })
})
