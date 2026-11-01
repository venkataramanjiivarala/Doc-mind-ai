import Groq from "groq-sdk";

let groqClient: Groq | null = null;

export function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY env var.");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export function getGroqModel(): string {
  const model = process.env.GROQ_MODEL?.trim();
  return model || "openai/gpt-oss-120b";
}

export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
