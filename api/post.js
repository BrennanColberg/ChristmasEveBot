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
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  console.log({ year, month, day })
  const today = new Date(year, month, day)
  console.log({ today })

  // figure out how many days there are until next Christmas
  if (month === 11 && day > 25) year += 1
  const christmas = new Date(year, 11, 25)
  console.log({ christmas })
  const daysUntilChristmas = (christmas - today) / 1000 / 60 / 60 / 24
  console.log({ daysUntilChristmas })

  // stage the necessary text into tweets
  const tweetsText = [PREFIX]
  for (let i = 0; i < daysUntilChristmas; i++) {
    const newText = i === daysUntilChristmas - 1 ? EVE + SUFFIX : EVE
    if (tweetsText[tweetsText - 1].length + newText > 280) tweetsText.push("")
    tweetsText[tweetsText - 1] += newText
  }
  console.log({ tweetsText })

  // TODO send all tweets, reply-chained into a thread

  // TODO change to 201 once implemented
  res.status(501).end()
}
