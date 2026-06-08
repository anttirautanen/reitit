/**
 * Pure keep/drop rule for the vehicles "passed-stop" filter.
 *
 * A vehicle is relevant to the route view only while it still has a curated
 * stop ahead of it (or is presently at one). Once it is past every curated
 * stop on its line and direction it is heading away from the curated set and
 * is dropped.
 *
 * Positions are the monotonic `stopPosition` values along the vehicle's own
 * trip. `currentStopPosition` is the position of the stop the vehicle is
 * currently related to (stopped at, incoming to, or in transit to);
 * `curatedStopPositions` are the positions of the curated stops located on the
 * same trip. The comparison is the same regardless of the vehicle's stop
 * status: a curated stop at a position greater than or equal to the vehicle's
 * current position is still upcoming (a stop the vehicle is currently at counts
 * as upcoming so it stays visible while serving your stop); anything strictly
 * before has been passed.
 *
 * The rule is conservative on uncertainty: when the vehicle's current position
 * cannot be located on its trip, or when no curated stop could be located on
 * the trip, the vehicle is kept rather than silently dropped.
 */

export interface PassedStopInput {
  currentStopPosition: number | null
  curatedStopPositions: number[]
}

export function keepVehiclePastCuratedStops(input: PassedStopInput): boolean {
  const { currentStopPosition, curatedStopPositions } = input
  if (currentStopPosition === null) return true
  if (curatedStopPositions.length === 0) return true
  return curatedStopPositions.some((position) => position >= currentStopPosition)
}
