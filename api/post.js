export default (req, res) => {
  // request must use POST method
  if (req.method !== "POST") return res.status(405).end(405)

  // request must be authenticated
  if (req.headers["x-api-key"] !== process.env.API_KEY) return res.status(401).end()

  // TODO change to 201 once implemented
  res.statusCode(501).end()
}
