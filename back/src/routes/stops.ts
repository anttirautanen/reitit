import { Router } from "express"

export function registerStopsRoutes(router: Router, deps: { digitransitApiKey: string }): void {
  const { digitransitApiKey } = deps

  router.get("/stops", async (req, res) => {
    const stopsResponse = await fetch("https://api.digitransit.fi/routing/v2/hsl/gtfs/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "digitransit-subscription-key": digitransitApiKey,
      },
      body: JSON.stringify({
        query: `
        {
          stops {
            gtfsId
            name
            lat
            lon
          }
        }
      `,
      }),
    })

    if (!stopsResponse.ok) {
      res.status(500).send({ success: false, error: "Failed to fetch stops from external API" })
      return
    }

    try {
      const stops = await stopsResponse.json()
      if (stops && typeof stops === "object" && "data" in stops) {
        res.send(stops.data)
      } else {
        res.status(500).send({ success: false, error: "Unexpected stops response format" })
      }
    } catch (error) {
      console.error(error)
      res.status(500).send({ success: false, error: "Failed to parse stops response" })
      return
    }
  })
}
