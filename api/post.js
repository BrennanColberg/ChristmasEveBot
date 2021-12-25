export default (req, res) => {
  // request must use POST method
  if (req.method !== "POST") return res.status(405).end(405)

  // request must be authenticated
  if (req.headers["x-api-key"] !== process.env.API_KEY) return res.status(401).end()

  // TODO get current day
  // TODO figure out how many days there are until next Christmas
  // TODO see how many tweets will be needed to fit all "Eve"s
  // TODO send all tweets, reply-chained into a thread

  // TODO change to 201 once implemented
  res.statusCode(501).end()
}
