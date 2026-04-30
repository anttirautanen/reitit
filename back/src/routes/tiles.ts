import { NextFunction, Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import { LRUCache } from "lru-cache"

type TileRequest = Request<{ z: string; x: string; y: string }>
const TILE_Z_MAX = 22

export function registerTileRoutes(router: Router, deps: { digitransitApiKey: string }): void {
  const { digitransitApiKey } = deps

  const tileCache = new LRUCache<string, Buffer>({
    max: 2000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  })

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 2000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
  })

  const validateTileRequest = (req: TileRequest, res: Response, next: NextFunction) => {
    const z = Number(req.params.z)
    const x = Number(req.params.x)
    const y = Number(req.params.y)

    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
      return res.status(400).send()
    }

    if (z < 0 || z > TILE_Z_MAX) {
      return res.status(400).send()
    }

    const n = 2 ** z
    if (x < 0 || x >= n || y < 0 || y >= n) {
      return res.status(400).send()
    }

    next()
  }

  router.get("/tiles/:z/:x/:y", limiter, validateTileRequest, async (req: TileRequest, res) => {
    const cacheKey = `${req.params.z}/${req.params.x}/${req.params.y}`
    const cached = tileCache.get(cacheKey)

    if (cached) {
      res.set("Content-Type", "image/png")
      res.set("Cache-Control", "public, max-age=86400, immutable") // 24 hours
      res.send(cached)
      return
    }

    const upstream = await fetch(`https://cdn.digitransit.fi/map/v3/hsl-map/${req.params.z}/${req.params.x}/${req.params.y}.png`, {
      headers: {
        "digitransit-subscription-key": digitransitApiKey,
      },
    })

    if (!upstream.ok) {
      res.status(502).send()
      console.error("Failed to load tile from upstream:", upstream.status, upstream.statusText)
      return
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    tileCache.set(cacheKey, buffer)

    res.set("Content-Type", "image/png")
    res.set("Cache-Control", "public, max-age=86400, immutable") // 24 hours
    res.send(buffer)
  })
}
