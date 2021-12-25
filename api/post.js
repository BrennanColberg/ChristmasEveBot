const Twitter = require("twitter")

const twitter = new Twitter({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_KEY_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
})

const PREFIX = "Merry Christmas"
const EVE = " Eve"
const SUFFIX = "!"

module.exports = async (req, res) => {
  // request must use POST method
  if (req.method !== "POST") return res.status(405).end()

  // request must be authenticated
  if (req.headers["x-api-key"] !== process.env.API_KEY) return res.status(401).end()

  // get current day
  const now = new Date()
  console.log({ now })
  let year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  console.log({ year, month, day })
  const today = new Date(year, month, day)
  console.log({ today })

  // figure out how many days there are until next Christmas
  if (month === 11 && day >= 25) year += 1
  const christmas = new Date(year, 11, 25)
  console.log({ christmas })
  const daysUntilChristmas = (christmas - today) / 1000 / 60 / 60 / 24
  console.log({ daysUntilChristmas })

  // generate the necessary text
  let text = PREFIX
  for (let i = 0; i < daysUntilChristmas; i++) text += EVE
  text += SUFFIX
  console.log({ text })

  // split text into tweet-sized chunks
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
  tweets = tweets.map((tweet) => tweet.replace("?", tweets.length).trim()).reverse()
  console.log({ tweets })

  // send all tweets, reply-chained into a thread
  const tweetIds = []
  for (let tweet of tweets) {
    const response = await twitter.post("/statuses/update", {
      status: tweet,
      in_reply_to_status_id: tweetIds[tweetIds.length - 1],
    })
    tweetIds.push(response.id_str)
  }
  console.log({ tweetIds })

  // return lots of info for easy API debugging
  res
    .status(201)
    .json({ now, year, month, day, today, christmas, daysUntilChristmas, text, tweets, tweetIds })
}
