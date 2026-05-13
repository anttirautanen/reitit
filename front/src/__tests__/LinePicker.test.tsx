import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { StopLinesApiResponse } from "@reitit/back/src/api"
import { LinePicker } from "../route/components/LinePicker"
import { useStopLinesQuery } from "../route/api"

vi.mock("../route/api", () => ({
  useStopLinesQuery: vi.fn(),
}))

interface QueryShape {
  data: StopLinesApiResponse | undefined
  isLoading: boolean
  isError: boolean
}

function setLines(value: QueryShape) {
  vi.mocked(useStopLinesQuery).mockReturnValue(
    value as unknown as ReturnType<typeof useStopLinesQuery>,
  )
}

const twoLines: StopLinesApiResponse = {
  lines: [
    { gtfsId: "HSL:1", shortName: "1", mode: "TRAM" },
    { gtfsId: "HSL:2", shortName: "2", mode: "BUS" },
  ],
}

describe("LinePicker", () => {
  beforeEach(() => {
    vi.mocked(useStopLinesQuery).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders a loading state while the query is pending", () => {
    setLines({ data: undefined, isLoading: true, isError: false })
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="add"
        initialSelected={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/loading lines/i)).toBeInTheDocument()
  })

  it("renders one row per line when data is available", () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="add"
        initialSelected={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    for (const line of twoLines.lines) {
      expect(screen.getByRole("button", { name: line.shortName })).toBeInTheDocument()
    }
  })

  it("pre-checks lines from initialSelected", () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="edit"
        initialSelected={["HSL:1"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const row1 = screen.getByRole("button", { name: "1" })
    const row2 = screen.getByRole("button", { name: "2" })
    expect(row1).toHaveAttribute("aria-pressed", "true")
    expect(row2).toHaveAttribute("aria-pressed", "false")
  })

  it("add mode: Save is disabled with zero selected and enabled after toggling one on", async () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="add"
        initialSelected={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const save = screen.getByRole("button", { name: /save/i })
    expect(save).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "1" }))

    await waitFor(() => {
      expect(save).not.toBeDisabled()
    })
  })

  it("edit mode: Save is enabled with zero selected and calls onSave with []", async () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="edit"
        initialSelected={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    const save = screen.getByRole("button", { name: /save/i })
    expect(save).not.toBeDisabled()
    fireEvent.click(save)
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    expect(onSave).toHaveBeenCalledWith([])
  })

  it("accumulates multiple selections and passes both ids to onSave", async () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="add"
        initialSelected={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "1" }))
    fireEvent.click(screen.getByRole("button", { name: "2" }))
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    const args = onSave.mock.calls[0][0] as string[]
    expect([...args].sort()).toEqual(["HSL:1", "HSL:2"])
  })

  it("Cancel triggers onCancel and not onSave", () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="edit"
        initialSelected={["HSL:1"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it("keeps the picker open with selection intact when onSave rejects", async () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    const onSave = vi.fn().mockRejectedValue(new Error("boom"))
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="edit"
        initialSelected={["HSL:1"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    // Picker still mounted, row still selected.
    const row1 = screen.getByRole("button", { name: "1" })
    expect(row1).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
  })

  it("renders the saveError strip when the prop is set", () => {
    setLines({ data: twoLines, isLoading: false, isError: false })
    render(
      <LinePicker
        stopId="HSL:stop"
        stopName="Test stop"
        mode="edit"
        initialSelected={["HSL:1"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saveError="Network error"
      />,
    )
    expect(screen.getByText("Network error")).toBeInTheDocument()
  })
})
