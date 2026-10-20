// One small interface over two providers: Claude (Anthropic SDK) or Gemini (Google GenAI SDK).
// AI_PROVIDER picks one explicitly; otherwise whichever key is set wins (Anthropic first).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class AIError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

export const aiProvider = () => {
    const pick = (process.env.AI_PROVIDER || "").trim().toLowerCase();
    const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    if (pick === "anthropic") return hasClaude ? "anthropic" : null;
    if (pick === "gemini") return hasGemini ? "gemini" : null;
    if (hasClaude) return "anthropic";
    if (hasGemini) return "gemini";
    return null;
};

export const aiModel = () => (aiProvider() === "anthropic" ? CLAUDE_MODEL : aiProvider() === "gemini" ? GEMINI_MODEL : null);

let anthropic = null;
let gemini = null;

const viaClaude = async ({ system, prompt, schema, effort }) => {
    anthropic ??= new Anthropic();
    try {
        const res = await anthropic.beta.messages.parse({
            model: CLAUDE_MODEL,
            max_tokens: 16000,
            // If the model declines, the API retries on a fallback model in the same call
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system,
            output_config: { effort, format: betaZodOutputFormat(schema) },
            messages: [{ role: "user", content: prompt }],
        });
        if (res.stop_reason === "refusal") throw new AIError("The AI declined to answer this one.", 422);
        if (res.stop_reason === "max_tokens" || !res.parsed_output) {
            throw new AIError("The AI response was incomplete. Try again.");
        }
        return { data: res.parsed_output, model: res.model };
    } catch (err) {
        if (err instanceof AIError) throw err;
        if (err instanceof Anthropic.AuthenticationError) throw new AIError("The Anthropic API key in server/.env is invalid.", 503);
        if (err instanceof Anthropic.PermissionDeniedError) throw new AIError("This Anthropic key can't use the configured model.", 503);
        if (err instanceof Anthropic.RateLimitError) throw new AIError("The AI is busy right now. Try again in a minute.", 429);
        if (err instanceof Anthropic.APIError) throw new AIError(`AI request failed (${err.status ?? "network"}).`);
        throw err;
    }
};

const viaGemini = async ({ system, prompt, schema }) => {
    gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema);
    let res;
    try {
        res = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: jsonSchema },
        });
    } catch (err) {
        const status = err.status || err.code;
        if (status === 400 && /api key/i.test(err.message)) throw new AIError("The Gemini API key in server/.env is invalid.", 503);
        if (status === 403) throw new AIError("This Gemini key can't use the configured model.", 503);
        if (status === 404) throw new AIError(`Gemini model "${GEMINI_MODEL}" was not found. Set GEMINI_MODEL in server/.env.`, 503);
        if (status === 429) throw new AIError("The AI is busy right now. Try again in a minute.", 429);
        throw new AIError(`AI request failed (${status || "network"}).`);
    }
    let parsed;
    try {
        parsed = schema.safeParse(JSON.parse(res.text || ""));
    } catch {
        parsed = { success: false };
    }
    if (!parsed.success) throw new AIError("The AI returned an unexpected format. Try again.");
    return { data: parsed.data, model: GEMINI_MODEL };
};

// Returns { data, model, provider } where data matches the zod schema.
export const generateObject = async ({ system, prompt, schema, effort = "medium" }) => {
    const provider = aiProvider();
    if (!provider) throw new AIError("AI isn't set up. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to server/.env.", 503);
    const result = provider === "anthropic"
        ? await viaClaude({ system, prompt, schema, effort })
        : await viaGemini({ system, prompt, schema });
    return { ...result, provider };
};
