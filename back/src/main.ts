import express from "express"
const app = express()
const port = "3000"

const apiRouter = express.Router()

apiRouter.get("/route", (req, res) => {
  res.send({
    start: "start-object-goes-here",
    target: "end-object-goes-here",
  })
})

app.use("/api", apiRouter)

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
