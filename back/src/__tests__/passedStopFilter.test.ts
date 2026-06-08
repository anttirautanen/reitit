import { describe, expect, it } from "vitest"
import { keepVehiclePastCuratedStops } from "../realtime/passedStopFilter.js"

describe("keepVehiclePastCuratedStops", () => {
  it("keeps a vehicle that is before a curated stop on its trip", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: 5, curatedStopPositions: [10] })).toBe(true)
  })

  it("drops a vehicle that is past the only curated stop on its trip", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: 10, curatedStopPositions: [5] })).toBe(false)
  })

  it("keeps a vehicle currently at a curated stop (equal position)", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: 5, curatedStopPositions: [5] })).toBe(true)
  })

  it("keeps a vehicle that has passed some but not all curated stops", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: 8, curatedStopPositions: [3, 12] })).toBe(true)
  })

  it("keeps a vehicle whose current position is unknown (conservative)", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: null, curatedStopPositions: [3] })).toBe(true)
  })

  it("keeps a vehicle when no curated stop could be located on its trip (conservative)", () => {
    expect(keepVehiclePastCuratedStops({ currentStopPosition: 5, curatedStopPositions: [] })).toBe(true)
  })
})
