import express from "express";
import { Groq } from "groq-sdk";
import cron from "node-cron";
import https from "https";
import { configDotenv } from "dotenv";
import { requestLogger, logger } from "./middleware/logger.js";
configDotenv();

const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map();

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
	logger.info("Processing USSD session turn", { text: req.body.text });
	const { sessionId, text } = req.body;

	let response = "";
	if (!text || text.trim() === "") {
		sessions.set(sessionId, [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
		]);
		setTimeout(
			() => {
				if (sessions.has(sessionId)) {
					sessions.delete(sessionId);
				}
			},
			3 * 60 * 1000,
		);
		response = `CON Welcome to USSD AI\nType your question below: `;
	} else {
		const inputs = text.split("*");
		const userPrompt = inputs[inputs.length - 1];
		const history = sessions.get(sessionId) || [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
		];

		history.push({ role: "user", content: userPrompt });

		try {
			const completion = await groq.chat.completions.create({
				messages: history,
				model: "openai/gpt-oss-20b",
				reasoning_format: "hidden", // Hides reasoning and forces direct output
			});

			const aiReply =
				completion.choices[0]?.message?.content ||
				"No answer generated.";

			history.push({ role: "assistant", content: aiReply });
			sessions.set(sessionId, history);
			response = `CON ${aiReply}\n\n(Reply to continue)`;
			console.log(history);
		} catch (err) {
			sessions.delete(sessionId);
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

const SYSTEM_PROMPT = `
You are "USSD AI", an offline assistant accessible via GSM USSD. Be very concise.

STRICT CONSTRAINTS & RULES:
1. IDENTITY & PROVIDER SECRECY:
   - NEVER mention OpenAI, Groq, Meta, Llama, Google, ChatGPT, or any underlying model/provider.
   - If asked "Who created you?" or "What model are you?", respond: "I am Cellular AI, an offline assistant designed for USSD."

2. USSD LENGTH & FORMATTING:
   - Response in less than 500 words, 
   - Do NOT use Markdown formatting (no bold **, no bullet points, no code blocks).
   - Use plain text only. Avoid emoji characters to prevent SMS/USSD decoding errors.

3. SAFETY & CONTENT BOUNDARIES:
   - REFUSE requests involving medical diagnosis, legal advice, dangerous activities, or sexually explicit content.
   - For restricted queries, reply: "I cannot fulfill this request due to USSD safety guidelines."

4. DIRECTNESS:
   - Do not waste tokens on greetings ("Hello", "Sure!") or closing pleasantries. Answer directly.
`;
