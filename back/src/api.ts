export interface POI {
  name: string
  coordinates: [number, number]
}

export interface ApiCuratedStop {
  stopId: string
  lines: string[]
}

export interface ApiRoute {
  id: number
  name: string
  origin: POI | null
  destination: POI | null
  curatedStops: ApiCuratedStop[]
}

export interface RoutesApiResponse {
  routes: ApiRoute[]
}

export interface ApiStop {
  gtfsId: string
  name: string
  lat: number
  lon: number
}

export interface StopsApiResponse {
  stops: ApiStop[]
}

export interface ApiStopLine {
  gtfsId: string
  shortName: string
  mode: string
}

/** Lines are returned in natural-sort `shortName` ascending order with `gtfsId` as a stable secondary key, so the frontend does not need to re-sort. */
export interface StopLinesApiResponse {
  lines: ApiStopLine[]
}

export interface ApiDeparture {
  scheduledAt: string
  realtimeAt: string
  isRealtime: boolean
  headsign: string
}

export interface ApiStopLineDepartures {
  gtfsId: string
  shortName: string
  departures: ApiDeparture[]
}

export interface ApiStopDepartures {
  stopId: string
  lines: ApiStopLineDepartures[]
}

export interface DeparturesApiResponse {
  stops: ApiStopDepartures[]
}

export interface ApiVehicle {
  id: string
  lineGtfsId: string
  lineShortName: string
  lon: number
  lat: number
  bearing: number | null
  speedMs: number | null
}

export interface VehiclesApiResponse {
  vehicles: ApiVehicle[]
}
