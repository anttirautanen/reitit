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
          trip {
            route {
              gtfsId
              shortName
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
