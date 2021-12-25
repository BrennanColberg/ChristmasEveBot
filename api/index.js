export default (req, res) => {
	const { name = "World" } = req.query;
	console.log(process.env);
	res.send(`Hello ${name}!`);
};
