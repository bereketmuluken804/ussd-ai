import express from "express";
import { Groq } from "groq-sdk";
import cron from "node-cron";
import https from "https";
import { configDotenv } from "dotenv";
import { requestLogger, logger } from "./middleware/logger.js";
configDotenv();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(requestLogger);


const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});

app.get("/health", (req, res) => {
	res.status(200).send("OK");
});

app.post("/ussd", async (req, res) => {
  logger.info('Processing USSD session turn', { text: req.body.text });
	const { text } = req.body;

	let response = "";
	if (!text || text.trim() === "") {
		response = `CON Welcome to USSD AI
    Type your query/prompt below: `;
	} else {
		const inputs = text.split("*");
		const userPrompt = inputs[inputs.length - 1];

		try {
			const completion = await groq.chat.completions.create({
				messages: [
					{
						role: "system",
						content:
							"You are an AI assistant accessed via USSD. Be extremely concise. Keep answers under 150 characters.",
					},
					{
						role: "user",
						content: userPrompt,
					},
				],
				model: "openai/gpt-oss-20b",
        reasoning_format: 'hidden', // Hides reasoning and forces direct output
			});

			const aiReply =
				completion.choices[0]?.message?.content ||
				"No answer generated.";
        console.log(completion.choices[0]?.message)
			response = `END ${aiReply}`;
		} catch (err) {
			console.error("Groq api error: ", err);
			response = `END Error: Failed to fetch AI response. Please try again.`;
		}
	}

	res.set("Content-Type", "text/plain");
	res.send(response);
});

app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
	const url = process.env.url;
	if (url) {
		cron.schedule("*/14 * * * *", () => {
			console.log("Sending self-ping to keep server awake...");
			https
				.get(`${url}/health`, (res) => {
					console.log(`Self-ping status: ${res.statusCode}`);
				})
				.on("error", (err) => {
					console.error("Self-ping error:", err.message);
				});
		});
	} else {
		console.log("RENDER_EXTERNAL_URL not set; self-ping disabled.");
	}
});
