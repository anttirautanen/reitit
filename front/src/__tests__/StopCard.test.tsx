import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { StopCard } from "../route/components/StopCard"

describe("StopCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the stop name", () => {
    render(<StopCard stopName="Rautatientori" lines={["HSL:1071"]} />)
    expect(screen.getByText("Rautatientori")).toBeInTheDocument()
  })

  it("renders one pill per line, each containing the line gtfsId text", () => {
    const lines = ["HSL:1071", "HSL:1095", "HSL:9"]
    render(<StopCard stopName="Test stop" lines={lines} />)
    for (const line of lines) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  })

  it("falls back to the blue pill class for an unknown gtfsId", () => {
    render(<StopCard stopName="Test stop" lines={["unknown-line-id"]} />)
    const pill = screen.getByText("unknown-line-id")
    expect(pill.className).toContain("bg-blue-600")
    expect(pill.className).toContain("text-white")
  })
})
