# Twitter OAuth 2.0 Setup for ChristmasEveBot

This document explains how to set up Twitter OAuth 2.0 for a single bot instance.

## Prerequisites

1. **Twitter Developer Account**: You need a Twitter Developer account
2. **Twitter App**: Create an app in the Twitter Developer Portal
3. **Redis Server**: Running Redis instance for storing bot auth tokens

## Setup Instructions

### 1. Create Twitter App

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or select an existing one
3. Navigate to your app's settings

### 2. Configure OAuth 2.0

1. In your Twitter app settings, go to **"User authentication settings"**
2. Enable **OAuth 2.0**
3. Set the following:
   - **Type of App**: Web App
   - **Callback URI**: `http://localhost:3000/oauth/callback`
   - **Website URL**: `http://localhost:3000`

### 3. Get Credentials

1. In your Twitter app, go to **"Keys and tokens"**
2. Copy your **Client ID** and **Client Secret**

### 4. Set Environment Variables

**REQUIRED** - The server will throw an error on startup if these are not set:

```bash
export TWITTER_CLIENT_ID="your_client_id_from_twitter"
export TWITTER_CLIENT_SECRET="your_client_secret_from_twitter"
```

**OPTIONAL** - Defaults shown:

```bash
export TWITTER_REDIRECT_URI="http://localhost:3000/oauth/callback"
export REDIS_URL="redis://localhost:6379"
export API_KEY="your_secure_api_key_for_posting"
```

### 5. Start the Server

```bash
cd v2
bun start
```

If environment variables are missing, you'll see an error like:

```
Error: TWITTER_CLIENT_ID environment variable is required
```

## OAuth Flow for Bot Setup

### One-Time Token Acquisition

1. **Start OAuth flow**: Navigate to `http://localhost:3000/oauth/start?botId=christmasevebot`
   (Replace `christmasevebot` with your chosen bot identifier)
2. **Authorize on Twitter**: You'll be redirected to Twitter to authorize the bot
3. **Get tokens**: After authorization, you'll be redirected back with plaintext output:

```
OAuth Success!

BOT_ID: christmasevebot
ACCESS_TOKEN: your_access_token_here
REFRESH_TOKEN: your_refresh_token_here
EXPIRES_IN: 7200
SCOPE: users.read tweet.write offline.access

Tokens have been stored in Redis for bot: christmasevebot
Use GET /oauth/bot/christmasevebot to retrieve stored tokens.
```

4. **Tokens stored automatically**: Tokens are automatically stored in Redis and can be retrieved using the bot ID

### API Endpoints

- `GET /oauth` - Status and available endpoints
- `GET /oauth/start?botId=<id>` - Begin OAuth flow (redirects to Twitter)
- `GET /oauth/callback` - OAuth callback (Twitter redirects here)
- `GET /oauth/bot/<botId>` - Retrieve stored bot tokens
- `DELETE /oauth/bot/<botId>` - Delete stored bot tokens
- `POST /oauth/test` - Test a token
- `POST /api/post` - Post Christmas Eve tweet

### Testing Your Token

To verify your access token works:

```bash
curl -X POST http://localhost:3000/oauth/test \
  -H "Content-Type: application/json" \
  -d '{"token": "your_access_token_here"}'
```

Expected response:

```
Token Test Success!

USER_ID: 123456789
USERNAME: yourusername
NAME: Your Display Name

Token is valid and ready for posting tweets.
```

## Using the Christmas Eve Bot

Once your bot is authenticated, you can post Christmas Eve tweets using the API:

```bash
curl -X POST http://localhost:3000/api/post \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secure_api_key" \
  -d '{"botId": "christmasevebot"}'
```

This will:

1. Calculate days until Christmas
2. Generate appropriate "Merry Christmas Eve Eve Eve..." text
3. Split into multiple tweets if needed (280 char limit)
4. Post as a threaded chain on Twitter
5. Return detailed response with tweet IDs

### Retrieving Stored Tokens

```bash
curl http://localhost:3000/oauth/bot/christmasevebot
```

Response:

```
Bot Auth Data

BOT_ID: christmasevebot
ACCESS_TOKEN: your_access_token_here
REFRESH_TOKEN: NOT_AVAILABLE
EXPIRES_IN: 7200
SCOPE: users.read tweet.write offline.access
CREATED_AT: 2024-01-01T12:00:00.000Z

Token is ready for use with Twitter API v2.
```

## Security Notes

- **Never commit tokens to version control**
- **Store tokens securely** (encrypted database, secure environment variables)
- **Use the refresh token** to get new access tokens when they expire
- **This setup is for a single bot** - each bot instance needs its own OAuth flow

## Scopes Requested

- `tweet.write` - Allows posting tweets
- `offline.access` - Provides refresh tokens for long-term access
- `users.read` - Allows reading user profile information

## Troubleshooting

- **Environment variable errors**: Make sure `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are set
- **Callback URL mismatch**: Ensure your Twitter app callback URL exactly matches the redirect URI
- **Invalid tokens**: Use the `/oauth/test` endpoint to verify token validity
- **Scope issues**: Make sure your Twitter app has the required permissions enabled
