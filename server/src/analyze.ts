import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  type LlmProvider,
  resolveGeminiModel,
  resolveLocalModel,
  resolveOpenAIModel,
} from "./modelIds.js";
import { ARCHITECT_SYSTEM_PROMPT } from "./prompt.js";
import { AnalysisResultSchema, type AnalysisResult } from "./schema.js";
import { mockAnalysis } from "./mockAnalysis.js";

function stripJsonFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return t;
}

/** First fenced ``` / ```json block, if any. */
function extractMarkdownJsonBlock(text: string): string | undefined {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = m?.[1]?.trim();
  return inner || undefined;
}

/**
 * First top-level `{ ... }` span with string-aware brace matching (handles prose before/after JSON).
 */
function extractFirstBalancedJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

function tryParseJsonObject(raw: string): unknown | undefined {
  const attempts: string[] = [];
  const trimmed = raw.trim();
  attempts.push(stripJsonFence(trimmed));
  const block = extractMarkdownJsonBlock(trimmed);
  if (block) attempts.push(block);
  const sliced = extractFirstBalancedJsonObject(trimmed);
  if (sliced) attempts.push(sliced);

  for (const candidate of attempts) {
    const c = candidate.trim();
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function parseAnalysisJson(raw: string): AnalysisResult {
  const parsed = tryParseJsonObject(raw);
  if (parsed === undefined) {
    const preview = raw.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      [
        "Model returned non-JSON (or JSON wrapped in extra text).",
        "Local models: use a JSON-friendly or coder-tuned model, or retry.",
        preview ? `Start of response: ${preview}${raw.length > 160 ? "…" : ""}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const result = AnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid analysis shape: ${result.error.message}`);
  }
  return result.data;
}

async function analyzeOpenAI(
  userText: string,
  apiKey: string,
  model: string,
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey: apiKey.trim() });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      { role: "system", content: ARCHITECT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `User requirements:\n"""${userText.slice(0, 12000)}"""`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty model response");
  }
  return parseAnalysisJson(raw);
}

function resolveLocalLlmBaseUrl(): string {
  let raw =
    process.env.LOCAL_LLM_BASE_URL?.trim() ||
    "http://127.0.0.1:11434/v1";
  raw = raw.replace(/\/+$/, "");

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid LOCAL_LLM_BASE_URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("LOCAL_LLM_BASE_URL must use http or https");
  }

  const path = u.pathname.replace(/\/+$/, "") || "";
  if (path === "" || path === "/") {
    raw = `${u.origin}/v1`;
  }

  return raw.replace(/\/+$/, "");
}

function localLlmApiKey(): string {
  return process.env.LOCAL_LLM_API_KEY?.trim() || "ollama";
}

function formatLocalConnectionError(baseURL: string, cause: unknown): Error {
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (/\b401\b|Unauthorized|incorrect api key/i.test(msg)) {
    return new Error(
      [
        `Authentication failed for ${baseURL}.`,
        "OpenClaw Gateway: set LOCAL_LLM_API_KEY to your bearer token (same value as OPENCLAW_GATEWAY_TOKEN / gateway.auth.token).",
        "Ollama ignores the key; use any non-empty placeholder there.",
      ].join(" "),
    );
  }
  if (/\b404\b|Not Found|\b405\b|Method Not Allowed/i.test(msg)) {
    return new Error(
      [
        `HTTP 404/405 from ${baseURL} — OpenAI-style /v1/chat/completions is not available on that URL.`,
        "OpenClaw on :18789: enable gateway HTTP chat completions, then restart:",
        "`openclaw config set gateway.http.endpoints.chatCompletions.enabled true` (see OpenClaw docs).",
        "If the model is Ollama (e.g. Gemma): use Ollama’s API — LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1 and LOCAL_LLM_MODEL from `ollama list` (e.g. gemma4:latest).",
      ].join(" "),
    );
  }
  if (
    /ECONNREFUSED|ENOTFOUND|fetch failed|socket|connect/i.test(msg) ||
    /Connection error/i.test(msg)
  ) {
    return new Error(
      [
        `Cannot reach local LLM at ${baseURL}.`,
        "Start an OpenAI-compatible server (e.g. run `ollama serve`, then `ollama pull qwen2.5-coder:7b`)",
        "or set LOCAL_LLM_BASE_URL to LM Studio / vLLM / OpenClaw (must expose /v1/chat/completions).",
      ].join(" "),
    );
  }
  return cause instanceof Error ? cause : new Error(msg);
}

/**
 * Local servers (Ollama, LM Studio) often omit or partially support OpenAI `response_format`;
 * the system prompt already requires raw JSON.
 */
async function analyzeLocalOpenAICompatible(
  userText: string,
  baseURL: string,
  apiKey: string,
  model: string,
): Promise<AnalysisResult> {
  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  try {
    const localUserSuffix =
      "\n\nReply with a single JSON object only. No markdown code fences, no commentary before or after the JSON.";

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: ARCHITECT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `User requirements:\n"""${userText.slice(0, 12000)}"""${localUserSuffix}`,
      },
    ];

    const tryJsonMode = process.env.LOCAL_LLM_JSON_MODE?.trim() !== "0";
    let completion: OpenAI.Chat.ChatCompletion;
    if (tryJsonMode) {
      try {
        completion = await client.chat.completions.create({
          model,
          temperature: 0.25,
          messages,
          response_format: { type: "json_object" },
        });
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        if (
          /\b400\b|unsupported|unknown field|invalid_request|response_format|json_object|schema/i.test(
            m,
          )
        ) {
          completion = await client.chat.completions.create({
            model,
            temperature: 0.25,
            messages,
          });
        } else {
          throw err;
        }
      }
    } else {
      completion = await client.chat.completions.create({
        model,
        temperature: 0.25,
        messages,
      });
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty model response");
    }
    return parseAnalysisJson(raw);
  } catch (e) {
    throw formatLocalConnectionError(baseURL, e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function geminiErrorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isRetryableGeminiError(e: unknown): boolean {
  const msg = geminiErrorText(e);
  return (
    /\b503\b/.test(msg) ||
    /\b429\b/.test(msg) ||
    /\b500\b/.test(msg) ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT/i.test(msg) ||
    /high demand|try again later|overloaded|temporarily/i.test(msg)
  );
}

/** Google often embeds "Please retry in 42.89s" in 429 bodies. */
function parseGeminiSuggestedRetryMs(msg: string): number | undefined {
  const m = msg.match(/Please retry in ([\d.]+)\s*s\b/i);
  if (!m) return undefined;
  const sec = Number.parseFloat(m[1]);
  if (!Number.isFinite(sec) || sec < 0) return undefined;
  const capped = Math.min(sec, 120);
  return Math.ceil(capped * 1000) + 800;
}

function isGeminiQuotaOrBillingError(msg: string): boolean {
  return (
    /exceeded your current quota|Quota exceeded|free_tier|free tier/i.test(msg) ||
    /billing details|rate-limits|GenerateRequestsPerDay|PerMinutePerModel/i.test(
      msg,
    ) ||
    /quotaMetric|QuotaFailure/i.test(msg)
  );
}

function formatGeminiFailure(model: string, cause: unknown): Error {
  const base = geminiErrorText(cause);
  const quota = isGeminiQuotaOrBillingError(base);
  const hint = quota
    ? [
        "This response is a Gemini quota / billing / free-tier limit from Google (not an app bug).",
        "• Docs: https://ai.google.dev/gemini-api/docs/rate-limits",
        "• In Google AI Studio or Cloud Console: enable billing or wait for your quota window to reset.",
        "• If free-tier limits show limit: 0, the model may be unavailable on your plan—try another Gemini model or use OpenAI in the UI.",
      ].join("\n")
    : [
        "Google may be busy (503) or the model is overloaded.",
        "We retried with backoff. Try again in a few minutes, or pick another Gemini model / use OpenAI.",
      ].join("\n");
  return new Error(`${base}\n\n${hint}`);
}

function nextGeminiRetryDelayMs(msg: string, attempt: number): number {
  const suggested = parseGeminiSuggestedRetryMs(msg);
  if (suggested !== undefined) {
    return suggested;
  }
  if (/\b429\b/.test(msg)) {
    return Math.min(45_000, 4000 * attempt + Math.floor(Math.random() * 800));
  }
  const base = 1200 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 600);
  return Math.min(20_000, base + jitter);
}

async function analyzeGemini(
  userText: string,
  apiKey: string,
  model: string,
): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: ARCHITECT_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
  });

  const prompt = `User requirements:\n"""${userText.slice(0, 12000)}"""`;
  const maxAttemptsTransient = 6;
  const maxAttemptsQuota = 3;
  let lastError: unknown;

  for (let attempt = 1; ; attempt++) {
    try {
      const result = await generativeModel.generateContent(prompt);
      const raw = result.response.text();
      if (!raw?.trim()) {
        throw new Error("Empty model response");
      }
      return parseAnalysisJson(raw);
    } catch (e) {
      lastError = e;
      const retryable = isRetryableGeminiError(e);
      const msg = geminiErrorText(e);
      const quotaish = isGeminiQuotaOrBillingError(msg);
      const cap = quotaish ? maxAttemptsQuota : maxAttemptsTransient;

      if (attempt < cap && retryable) {
        const waitMs = nextGeminiRetryDelayMs(msg, attempt);
        await sleep(waitMs);
        continue;
      }
      if (retryable) {
        throw formatGeminiFailure(model, e);
      }
      throw e;
    }
  }
}

export type AnalyzeRequirementsOptions = {
  provider: LlmProvider;
  model?: string;
};

export type AnalyzeKeys = {
  openai?: string;
  gemini?: string;
};

export async function analyzeRequirements(
  userText: string,
  options: AnalyzeRequirementsOptions,
  keys: AnalyzeKeys,
): Promise<{
  data: AnalysisResult;
  resolvedProvider: LlmProvider;
  resolvedModel: string;
  demo_mode: boolean;
}> {
  const provider = options.provider;

  if (provider === "local") {
    const baseURL = resolveLocalLlmBaseUrl();
    const model = resolveLocalModel(options.model);
    const data = await analyzeLocalOpenAICompatible(
      userText,
      baseURL,
      localLlmApiKey(),
      model,
    );
    return {
      data,
      resolvedProvider: "local",
      resolvedModel: model,
      demo_mode: false,
    };
  }

  if (provider === "openai") {
    const key = keys.openai?.trim();
    const model = resolveOpenAIModel(options.model);
    if (!key) {
      return {
        data: mockAnalysis(userText),
        resolvedProvider: "openai",
        resolvedModel: model,
        demo_mode: true,
      };
    }
    const data = await analyzeOpenAI(userText, key, model);
    return {
      data,
      resolvedProvider: "openai",
      resolvedModel: model,
      demo_mode: false,
    };
  }

  const key = keys.gemini?.trim();
  const model = resolveGeminiModel(options.model);
  if (!key) {
    return {
      data: mockAnalysis(userText),
      resolvedProvider: "gemini",
      resolvedModel: model,
      demo_mode: true,
    };
  }
  const data = await analyzeGemini(userText, key, model);
  return {
    data,
    resolvedProvider: "gemini",
    resolvedModel: model,
    demo_mode: false,
  };
}
