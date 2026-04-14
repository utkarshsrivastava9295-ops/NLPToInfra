export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
/** Default for Ollama / OpenAI-compatible local servers (coding-oriented). */
export const DEFAULT_LOCAL_MODEL = "qwen2.5-coder:7b";

const SAFE_ID = /^[a-zA-Z0-9_.-]{1,96}$/;
/** Ollama-style names: tags, slashes, colons (e.g. qwen2.5-coder:7b, registry/model). */
const SAFE_LOCAL_MODEL = /^[a-zA-Z0-9_./:-]{1,160}$/;

export function resolveOpenAIModel(requested: string | undefined): string {
  const m =
    requested?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL;
  if (!SAFE_ID.test(m)) {
    throw new Error("Invalid OpenAI model id");
  }
  return m;
}

export function resolveGeminiModel(requested: string | undefined): string {
  const m =
    requested?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  if (!SAFE_ID.test(m)) {
    throw new Error("Invalid Gemini model id");
  }
  return m;
}

export function resolveLocalModel(requested: string | undefined): string {
  const m =
    requested?.trim() ||
    process.env.LOCAL_LLM_MODEL?.trim() ||
    DEFAULT_LOCAL_MODEL;
  if (!SAFE_LOCAL_MODEL.test(m)) {
    throw new Error("Invalid local model id");
  }
  return m;
}

export type LlmProvider = "openai" | "gemini" | "local";

export function parseProvider(raw: unknown): LlmProvider {
  if (raw === "gemini" || raw === "openai" || raw === "local") return raw;
  return "openai";
}
