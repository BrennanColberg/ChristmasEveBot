import { redis } from "bun"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
if (!REDIS_URL) throw "REDIS_URL environment variable is not set"
const REDIS_KEY = `ChristmasEveBot/oauth`

export interface BotAuthData {
  access_token: string
  refresh_token: string
  expires_in?: number
  scope: string
  created_at: number
}

export async function storeAuthData(authData: BotAuthData) {
  await redis.set(REDIS_KEY, JSON.stringify(authData))
  await redis.expire(REDIS_KEY, 86400 * 30) // 30 days
}

export async function getAuthData(): Promise<BotAuthData | null> {
  const data = await redis.get(REDIS_KEY)
  console.log("authData", JSON.stringify(data))
  return data ? JSON.parse(data) : null
}
