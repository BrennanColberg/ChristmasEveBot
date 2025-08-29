import express, { type Request, type Response } from "express"
import crypto from "crypto"
import { storeAuthData } from "./redis"
import { OAuth2User } from "twitter-api-sdk/dist/OAuth2User"
import Client from "twitter-api-sdk"

const router = express.Router()

// Environment variables - required for OAuth to work
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!
const TWITTER_REDIRECT_URI =
  process.env.TWITTER_REDIRECT_URI || "http://localhost:3000/oauth/callback"

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

export const twitterAuthClient = new OAuth2User({
  client_id: TWITTER_CLIENT_ID,
  client_secret: TWITTER_CLIENT_SECRET,
  callback: TWITTER_REDIRECT_URI,
  scopes: ["tweet.read", "tweet.write", "offline.access", "users.read"],
})

// Start OAuth flow
router.get("/", (req: Request, res: Response) => {
  const apiKey = req.query.API_KEY
  if (!apiKey || apiKey !== process.env.API_KEY)
    return res.status(401).json({ error: "Unauthorized - invalid API key" })

  // Generate PKCE values
  const state = crypto.randomBytes(16).toString("hex")
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store code verifier for later use
  codeVerifierStore.set(state, JSON.stringify({ codeVerifier }))

  // Twitter OAuth 2.0 authorization URL
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize")
  authUrl.searchParams.append("response_type", "code")
  authUrl.searchParams.append("client_id", TWITTER_CLIENT_ID)
  authUrl.searchParams.append("redirect_uri", TWITTER_REDIRECT_URI)
  authUrl.searchParams.append("scope", "tweet.read tweet.write offline.access users.read")
  authUrl.searchParams.append("state", state)
  authUrl.searchParams.append("code_challenge", codeChallenge)
  authUrl.searchParams.append("code_challenge_method", "S256")

  console.log("Redirecting to Twitter OAuth:", authUrl.toString().replace("twitter.com", "x.com"))
  res.redirect(authUrl.toString())
})

// OAuth callback
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query
  if (error) return res.type("text/plain").status(400).send(`OAuth Error: ${error}`)
  if (!code) return res.type("text/plain").status(400).send("Error: Missing authorization code")
  if (!state) return res.type("text/plain").status(400).send("Error: Missing authorization state")

  // Retrieve and verify code verifier
  const storedData = codeVerifierStore.get(state as string)
  if (!storedData) return res.type("text/plain").status(400).send("Error: Invalid state parameter")
  const { codeVerifier } = JSON.parse(storedData)
  if (!codeVerifier)
    return res.type("text/plain").status(400).send("Error: Invalid stored OAuth data")
  codeVerifierStore.delete(state as string)

  try {
    // Exchange authorization code for access token
    const { token } = await twitterAuthClient.requestAccessToken(code as string)
    if (!token.access_token) throw new Error("Access token is missing")
    console.log("OAuth Success! Token received:", token)

    const botTwitterClient = new Client(token.access_token)
    const twitterUserResponse = await botTwitterClient.users.findMyUser({
      "user.fields": [
        "id",
        "name",
        "username",
        "profile_image_url",
        "description",
        "public_metrics",
      ],
    })
    if (twitterUserResponse.data?.username !== "ChristmasEveBot")
      throw new Error("only @ChristmasEveBot is allowed to authenticate")

    await storeAuthData(token)

    // Return tokens as plaintext for the bot to capture
    res.type("text/plain").send(`OAuth Success!

ACCESS_TOKEN: ${token.access_token || "MISSING"}
REFRESH_TOKEN: ${token.refresh_token || "MISSING"}
SCOPE: ${token.scope || "UNKNOWN"}
EXPIRES_AT: ${token.expires_at || "UNKNOWN"}

Tokens have been stored in Redis`)
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

export default router
