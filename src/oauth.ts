import express, { type Request, type Response } from "express"
import crypto from "crypto"
import { redis } from "bun"

const router = express.Router()

// Environment variables - required for OAuth to work
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET
const TWITTER_REDIRECT_URI =
  process.env.TWITTER_REDIRECT_URI || "http://localhost:3000/oauth/callback"
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

// Validate required environment variables
if (!TWITTER_CLIENT_ID) {
  throw new Error("TWITTER_CLIENT_ID environment variable is required")
}

if (!TWITTER_CLIENT_SECRET) {
  throw new Error("TWITTER_CLIENT_SECRET environment variable is required")
}

console.log('Using Redis with Bun built-in client at:', REDIS_URL)

// Store code verifier temporarily (in production, use proper session storage)
const codeVerifierStore = new Map<string, string>()

// Utility functions for PKCE
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

// Bot auth storage functions
interface BotAuthData {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  created_at: number
}

async function storeBotAuth(botId: string, authData: BotAuthData): Promise<void> {
  const key = `bot:auth:${botId}`
  await redis.set(key, JSON.stringify(authData))
  // Set expiration for 30 days (30 * 24 * 60 * 60 seconds)
  await redis.expire(key, 86400 * 30)
  console.log(`Stored auth data for bot: ${botId}`)
}

async function getBotAuth(botId: string): Promise<BotAuthData | null> {
  const key = `bot:auth:${botId}`
  const data = await redis.get(key)
  return data ? JSON.parse(data as string) : null
}

async function deleteBotAuth(botId: string): Promise<void> {
  const key = `bot:auth:${botId}`
  await redis.del(key)
  console.log(`Deleted auth data for bot: ${botId}`)
}

// OAuth status endpoint
router.get("/", (req: Request, res: Response) => {
  res.type("text/plain").send(`Twitter OAuth 2.0 Ready

TWITTER_REDIRECT_URI: ${TWITTER_REDIRECT_URI}

Available endpoints:
- GET /oauth/start - Begin OAuth flow
- GET /oauth/callback - OAuth callback (set this as your Twitter app callback URL)
- POST /oauth/test - Test a token (send JSON: {"token": "your_token"})

To start OAuth flow, navigate to: /oauth/start`)
})

// Start OAuth flow
router.get("/start", (req: Request, res: Response) => {
  const { botId } = req.query
  
  if (!botId || typeof botId !== 'string') {
    return res.type("text/plain").status(400).send("Error: botId query parameter is required")
  }

  // Generate PKCE values
  const state = crypto.randomBytes(16).toString("hex")
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store code verifier AND botId for later use
  codeVerifierStore.set(state, JSON.stringify({ codeVerifier, botId }))

  // Twitter OAuth 2.0 authorization URL
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize")
  authUrl.searchParams.append("response_type", "code")
  authUrl.searchParams.append("client_id", TWITTER_CLIENT_ID)
  authUrl.searchParams.append("redirect_uri", TWITTER_REDIRECT_URI)
  authUrl.searchParams.append("scope", "tweet.write offline.access users.read")
  authUrl.searchParams.append("state", state)
  authUrl.searchParams.append("code_challenge", codeChallenge)
  authUrl.searchParams.append("code_challenge_method", "S256")

  console.log(`Starting OAuth flow for bot: ${botId}`)
  console.log("Redirecting to Twitter OAuth:", authUrl.toString())
  res.redirect(authUrl.toString())
})

// OAuth callback
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query

  if (error) {
    return res.type("text/plain").status(400).send(`OAuth Error: ${error}`)
  }

  if (!code || !state) {
    return res.type("text/plain").status(400).send("Error: Missing authorization code or state")
  }

  // Retrieve code verifier and botId
  const storedData = codeVerifierStore.get(state as string)
  if (!storedData) {
    return res.type("text/plain").status(400).send("Error: Invalid state parameter")
  }

  const { codeVerifier, botId } = JSON.parse(storedData)
  if (!codeVerifier || !botId) {
    return res.type("text/plain").status(400).send("Error: Invalid stored OAuth data")
  }

  // Clean up stored verifier
  codeVerifierStore.delete(state as string)

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: TWITTER_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error("Token exchange failed:", errorText)
      return res.type("text/plain").status(400).send(`Token exchange failed: ${errorText}`)
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }

    console.log("OAuth Success! Tokens received:", {
      access_token: tokens.access_token ? "RECEIVED" : "MISSING",
      refresh_token: tokens.refresh_token ? "RECEIVED" : "MISSING",
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    })

    // Store tokens in Redis
    if (tokens.access_token) {
      const authData: BotAuthData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        created_at: Date.now()
      }
      await storeBotAuth(botId, authData)
    }

    // Return tokens as plaintext for the bot to capture
    res.type("text/plain").send(`OAuth Success!

BOT_ID: ${botId}
ACCESS_TOKEN: ${tokens.access_token || "MISSING"}
REFRESH_TOKEN: ${tokens.refresh_token || "MISSING"}
EXPIRES_IN: ${tokens.expires_in || "UNKNOWN"}
SCOPE: ${tokens.scope || "UNKNOWN"}

Tokens have been stored in Redis for bot: ${botId}
Use GET /oauth/bot/${botId} to retrieve stored tokens.`)
  } catch (error) {
    console.error("OAuth callback error:", error)
    res.type("text/plain").status(500).send(`Internal server error: ${error}`)
  }
})

// Test endpoint to verify token
router.post("/test", async (req: Request, res: Response) => {
  const { token } = req.body

  if (!token) {
    return res.type("text/plain").status(400).send("Error: No token provided in request body")
  }

  try {
    // Test the token by getting user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      return res.type("text/plain").status(400).send(`Token test failed: ${errorText}`)
    }

    const userData = (await userResponse.json()) as {
      data: {
        id: string
        username: string
        name: string
      }
    }

    res.type("text/plain").send(`Token Test Success!

USER_ID: ${userData.data.id}
USERNAME: ${userData.data.username}
NAME: ${userData.data.name}

Token is valid and ready for posting tweets.`)
  } catch (error) {
    console.error("Token test error:", error)
    res.type("text/plain").status(500).send(`Error testing token: ${error}`)
  }
})

// Get bot auth data
router.get("/bot/:botId", async (req: Request, res: Response) => {
  const { botId } = req.params
  
  if (!botId) {
    return res.type("text/plain").status(400).send("Error: botId parameter is required")
  }

  try {
    const authData = await getBotAuth(botId)
    
    if (!authData) {
      return res.type("text/plain").status(404).send(`No auth data found for bot: ${botId}`)
    }

    const createdDate = new Date(authData.created_at).toISOString()
    
    res.type("text/plain").send(`Bot Auth Data

BOT_ID: ${botId}
ACCESS_TOKEN: ${authData.access_token}
REFRESH_TOKEN: ${authData.refresh_token || "NOT_AVAILABLE"}
EXPIRES_IN: ${authData.expires_in || "UNKNOWN"}
SCOPE: ${authData.scope || "UNKNOWN"}
CREATED_AT: ${createdDate}

Token is ready for use with Twitter API v2.`)

  } catch (error) {
    console.error("Error retrieving bot auth:", error)
    res.type("text/plain").status(500).send(`Error retrieving auth data: ${error}`)
  }
})

// Delete bot auth data
router.delete("/bot/:botId", async (req: Request, res: Response) => {
  const { botId } = req.params
  
  if (!botId) {
    return res.type("text/plain").status(400).send("Error: botId parameter is required")
  }

  try {
    await deleteBotAuth(botId)
    res.type("text/plain").send(`Auth data deleted for bot: ${botId}`)
  } catch (error) {
    console.error("Error deleting bot auth:", error)
    res.type("text/plain").status(500).send(`Error deleting auth data: ${error}`)
  }
})

export default router
