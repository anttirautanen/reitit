/**
 * GraphQL operations sent to the Digitransit routing API.
 *
 * Each operation is exported as a string constant. Future tasks will add
 * VEHICLE_POSITIONS_QUERY and a pattern lookup here.
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
