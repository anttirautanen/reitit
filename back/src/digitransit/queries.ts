/**
 * GraphQL operations sent to the Digitransit routing API.
 *
 * Each operation is exported as a string constant. Future tasks will add
 * STOP_DEPARTURES_QUERY, VEHICLE_POSITIONS_QUERY, and a pattern lookup here.
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
