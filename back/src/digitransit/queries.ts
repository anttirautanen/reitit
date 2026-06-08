/**
 * GraphQL operations sent to the Digitransit routing API.
 *
 * Each operation is exported as a string constant.
 */

export const STOP_LINES_QUERY = `
  query StopLines($stopId: String!) {
    stop(id: $stopId) {
      routes {
        gtfsId
        shortName
        mode
      }
    }
  }
`

/**
 * For a given stop, fetch the patterns that serve it together with the line
 * (route) gtfsId and direction. Used by the realtime pattern resolver to map
 * each curated `(stopId, lineGtfsId)` pair onto the line's direction(s) at
 * that stop. Patterns are static reference data so the resolver caches the
 * answer aggressively (see `createPatternResolver`).
 */
export const STOP_PATTERNS_QUERY = `
  query StopPatterns($stopId: String!) {
    stop(id: $stopId) {
      patterns {
        directionId
        route {
          gtfsId
        }
      }
    }
  }
`

/**
 * Fetches live vehicle positions for a list of route gtfs ids. Direction is
 * carried via the parent `pattern.directionId` (the `vehiclePosition` itself
 * does not always carry direction in Digitransit's schema), so the handler
 * threads `directionId` from the surrounding pattern through to each vehicle.
 *
 * `stopRelationship` reports the stop the vehicle is currently related to (the
 * stop it is stopped at, incoming to, or in transit to). Combined with the
 * trip's `stoptimes` (each carrying a monotonic `stopPosition`), it lets the
 * handler tell whether a vehicle has already passed a curated stop — see the
 * passed-stop filter. Both arrive inline so the filter adds no extra round
 * trips.
 */
export const VEHICLE_POSITIONS_QUERY = `
  query VehiclePositions($routeIds: [String!]!) {
    routes(ids: $routeIds) {
      gtfsId
      shortName
      patterns {
        directionId
        vehiclePositions {
          vehicleId
          stopRelationship {
            status
            stop {
              gtfsId
            }
          }
          trip {
            route {
              gtfsId
              shortName
            }
            stoptimes {
              stopPosition
              stop {
                gtfsId
              }
            }
          }
          lat
          lon
          heading
          speed
        }
      }
    }
  }
`

/**
 * Fetches the next four upcoming departures per stop for a list of stop ids.
 *
 * `scheduledDeparture` and `realtimeDeparture` are seconds since service-day
 * midnight; the handler converts them to ISO-8601 timestamps using
 * `serviceDay` (an epoch-seconds value at the service day's local midnight)
 * when present.
 */
export const STOP_DEPARTURES_QUERY = `
  query StopDepartures($stopIds: [String!]!) {
    stops(ids: $stopIds) {
      gtfsId
      stoptimesWithoutPatterns(numberOfDepartures: 4) {
        scheduledDeparture
        realtimeDeparture
        realtime
        serviceDay
        headsign
        trip {
          route {
            gtfsId
            shortName
          }
        }
      }
    }
  }
`
