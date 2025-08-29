import express from "express"
import oauthRouter from "./oauth.js"
import apiRouter from "./post.js"

const app = express()
const port = process.env.PORT || 3000

// Basic middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Mount routers
app.use("/oauth", oauthRouter)
app.use("/api/post", apiRouter)

// Root route
app.get("/", (req, res) => {
  res.type("text/plain").send(`ChristmasEveBot v2 Server

Available endpoints:
- GET /oauth - OAuth status and available endpoints
- GET /oauth/start?botId=<id> - Begin Twitter OAuth flow
- GET /oauth/callback - OAuth callback (configure this in your Twitter app)
- GET /oauth/bot/<botId> - Retrieve stored bot auth tokens
- DELETE /oauth/bot/<botId> - Delete stored bot auth tokens
- POST /oauth/test - Test an access token
- POST /api/post - Post Christmas Eve tweet (requires botId and x-api-key)

For OAuth setup, see OAUTH.md`)
})

app.listen(port, () => {
  console.log(`ChristmasEveBot v2 server running on http://localhost:${port}`)
  console.log("")
  console.log("Available endpoints:")
  console.log(`- GET http://localhost:${port}/oauth - OAuth status`)
  console.log(`- GET http://localhost:${port}/oauth/start?botId=<id> - Begin OAuth flow`)
  console.log(`- GET http://localhost:${port}/oauth/bot/<botId> - Get bot tokens`)
  console.log(`- POST http://localhost:${port}/api/post - Post Christmas Eve tweet`)
  console.log("")
  console.log("See OAUTH.md for complete setup instructions")
})
