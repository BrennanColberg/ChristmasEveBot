import express, { type Request, type Response } from "express"
import { redis } from "bun"

const router = express.Router()

// Bot auth data interface
interface BotAuthData {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  created_at: number
}

async function getBotAuth(botId: string): Promise<BotAuthData | null> {
  const key = `bot:auth:${botId}`
  const data = await redis.get(key)
  return data ? JSON.parse(data as string) : null
}

// Christmas Eve bot posting logic
router.post("/", async (req: Request, res: Response) => {
  // Request must use POST method (already enforced by route)

  // Request must be authenticated
  const apiKey = req.headers["x-api-key"]
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized - invalid API key" })
  }

  // Get botId from request body or query
  const { botId } = req.body || req.query
  if (!botId || typeof botId !== "string") {
    return res.status(400).json({ error: "botId is required" })
  }

  try {
    // Get bot auth tokens from Redis
    const authData = await getBotAuth(botId)
    if (!authData) {
      return res.status(404).json({ error: `No auth data found for bot: ${botId}` })
    }

    // Get current date
    const now = new Date()
    console.log({ now })
    let year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()
    console.log({ year, month, day })
    const today = new Date(year, month, day)
    console.log({ today })

    // Figure out how many days there are until next Christmas
    if (month === 11 && day > 25) year += 1
    const christmas = new Date(year, 11, 25)
    console.log({ christmas })
    const daysUntilChristmas = (christmas.getTime() - today.getTime()) / 1000 / 60 / 60 / 24
    console.log({ daysUntilChristmas })

    // Generate the necessary text
    const PREFIX = "Merry Christmas"
    const EVE = " Eve"
    const SUFFIX = "!"

    let text = PREFIX
    for (let i = 0; i < daysUntilChristmas; i++) text += EVE
    text += SUFFIX
    console.log({ text })

    // Split text into tweet-sized chunks (Twitter v2 allows 280 chars)
    let tweets = [""] // in "reverse order" (0 = last tweet) while being composed
    for (let chunk of text.split(" ")) {
      const newText = " " + chunk
      if (tweets[0].length + newText.length > 280 - 7) {
        tweets[0] += `… (${tweets.length}/?)`
        tweets = ["", ...tweets]
      }
      tweets[0] += newText
    }
    if (tweets.length > 1) tweets[0] += ` (${tweets.length}/?)`
    tweets = tweets.map((tweet) => tweet.replace("?", tweets.length.toString()).trim()).reverse()
    console.log({ tweets })

    // Send all tweets using Twitter API v2, reply-chained into a thread
    const tweetIds: string[] = []

    for (let tweet of tweets) {
      const tweetPayload: any = {
        text: tweet,
      }

      // Add reply parameter if this is not the first tweet
      if (tweetIds.length > 0) {
        tweetPayload.reply = {
          in_reply_to_tweet_id: tweetIds[tweetIds.length - 1],
        }
      }

      const response = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tweetPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Tweet posting failed:", errorText)
        return res.status(500).json({
          error: "Failed to post tweet",
          details: errorText,
          tweetNumber: tweetIds.length + 1,
          successfulTweets: tweetIds.length,
        })
      }

      const result = (await response.json()) as { data: { id: string } }
      tweetIds.push(result.data.id)
      console.log(`Posted tweet ${tweetIds.length}/${tweets.length}: ${result.data.id}`)
    }

    console.log({ tweetIds })

    // Return lots of info for easy API debugging
    res.status(201).json({
      botId,
      now,
      year,
      month,
      day,
      today,
      christmas,
      daysUntilChristmas,
      text,
      tweets,
      tweetIds,
      success: true,
    })
  } catch (error) {
    console.error("Post endpoint error:", error)
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
