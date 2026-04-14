export type AiProvider = "openai" | "gemini" | "local";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
/** Matches server default; strong at code / structured JSON (pull with Ollama first). */
export const DEFAULT_LOCAL_MODEL = "qwen2.5-coder:7b";

export const OPENAI_MODELS: { value: string; label: string }[] = [
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

export const GEMINI_MODELS: { value: string; label: string }[] = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recommended)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (may 503 when busy)" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];

/** Offline / local OpenAI-compatible API (OpenClaw gateway, Ollama, LM Studio, …). */
export const LOCAL_MODELS: { value: string; label: string }[] = [
  {
    value: "openclaw/default",
    label: "OpenClaw — default agent (recommended)",
  },
  { value: "openclaw", label: "OpenClaw — openclaw" },
  { value: "gemma4:latest", label: "Ollama — Gemma 4 (use exact tag from ollama list)" },
  { value: "qwen2.5-coder:7b", label: "Ollama — Qwen 2.5 Coder 7B" },
  { value: "qwen2.5-coder:32b", label: "Qwen 2.5 Coder 32B" },
  { value: "deepseek-coder-v2:16b", label: "DeepSeek Coder V2 16B" },
  { value: "codellama:13b", label: "Code Llama 13B" },
  { value: "llama3.1:8b", label: "Llama 3.1 8B" },
  { value: "mistral:7b", label: "Mistral 7B" },
];

export type ApiConfig = {
  openai_configured: boolean;
  gemini_configured: boolean;
  local_configured?: boolean;
};
