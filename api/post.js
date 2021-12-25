const PREFIX = "Merry Christmas"
const EVE = " Eve"
const SUFFIX = "!"

export default (req, res) => {
  // request must use POST method
  if (req.method !== "POST") return res.status(405).end()

  // request must be authenticated
  if (req.headers["x-api-key"] !== process.env.API_KEY) return res.status(401).end()

  // get current day
  const now = new Date()
  console.log({ now })
  const year = req.body.year || now.getFullYear()
  const month = req.body.month || now.getMonth()
  const day = req.body.day || now.getDate()
  console.log({ year, month, day })
  const today = new Date(year, month, day)
  console.log({ today })

  // figure out how many days there are until next Christmas
  if (month === 11 && day > 25) year += 1
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
  const tweets = []
  for (let chunk of tweets.split(" ")) {
    if (tweets[tweets.length - 1] + chunk.length + 1 > 280) tweets.push("")
    tweets[tweets.length - 1] += chunk
  }
  console.log({ tweets })

  // TODO send all tweets, reply-chained into a thread

  // TODO change to 201 once implemented
  res
    .status(501)
    .send({ now, year, month, day, today, christmas, daysUntilChristmas, text, tweets })
}
