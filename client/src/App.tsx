import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_LOCAL_MODEL,
  DEFAULT_OPENAI_MODEL,
  GEMINI_MODELS,
  LOCAL_MODELS,
  OPENAI_MODELS,
  type AiProvider,
} from "./aiOptions";
import { analyze, downloadInfraBundle, fetchApiConfig } from "./api";
import { TopologyPanel } from "./TopologyPanel";
import type { AnalyzeResponse } from "./types";

const example =
  "I have a web app: Node.js frontend and Python FastAPI backend with PostgreSQL. " +
  "Expect roughly 50k daily users, need high availability in production, budget around $400/month, region us-east-1.";

export default function App() {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [openaiModel, setOpenaiModel] = useState(DEFAULT_OPENAI_MODEL);
  const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [localModel, setLocalModel] = useState(DEFAULT_LOCAL_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [apiConfig, setApiConfig] = useState<{
    openai_configured: boolean;
    gemini_configured: boolean;
    local_configured?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    fetchApiConfig()
      .then(setApiConfig)
      .catch(() => setApiConfig(null));
  }, []);

  const selectedModel =
    customModel.trim() ||
    (provider === "openai"
      ? openaiModel
      : provider === "gemini"
        ? geminiModel
        : localModel);

  const onAnalyze = useCallback(async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const data = await analyze(
        text.trim() || example,
        provider,
        selectedModel,
        repoUrl,
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [text, provider, selectedModel, repoUrl]);

  const onDownload = useCallback(async () => {
    if (!result?.terraform_files?.length) return;
    try {
      await downloadInfraBundle(result, "nlp-to-infra-bundle.zip");
    } catch {
      setError("Could not build ZIP. Is the API running?");
    }
  }, [result]);

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="absolute -left-32 top-20 h-72 w-72 animate-float rounded-full bg-accent/20 blur-3xl" />
        <div
          className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-coral/15 blur-3xl"
          style={{ animation: "float 8s ease-in-out infinite 1s" }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent-glow backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Natural language → architecture → Terraform
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
            Describe your stack.
            <span className="block bg-gradient-to-r from-accent via-teal-200 to-coral bg-clip-text text-transparent">
              Get infra that fits.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 md:text-lg">
            Tell us about runtimes, traffic, budget, region, and whether this is
            production. We analyze load and availability, sketch the resource
            graph, and package Terraform you can refine and apply.
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="rounded-3xl border border-white/10 bg-ink-900/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8"
        >
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                AI provider
              </label>
              <div className="flex rounded-2xl border border-white/10 bg-ink-950/80 p-1">
                {(
                  [
                    { id: "openai" as const, label: "OpenAI" },
                    { id: "gemini" as const, label: "Gemini" },
                    { id: "local" as const, label: "Local (offline)" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProvider(opt.id)}
                    className={`flex-1 rounded-xl px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                      provider === opt.id
                        ? "bg-white/10 text-white shadow-inner ring-1 ring-accent/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                    {apiConfig &&
                      opt.id !== "local" &&
                      ((opt.id === "openai" && !apiConfig.openai_configured) ||
                        (opt.id === "gemini" && !apiConfig.gemini_configured)) && (
                        <span className="ml-1.5 text-[10px] font-normal text-amber-400/90">
                          (no key)
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="model-select"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Model
              </label>
              <select
                id="model-select"
                value={
                  provider === "openai"
                    ? openaiModel
                    : provider === "gemini"
                      ? geminiModel
                      : localModel
                }
                onChange={(e) => {
                  if (provider === "openai") setOpenaiModel(e.target.value);
                  else if (provider === "gemini") setGeminiModel(e.target.value);
                  else setLocalModel(e.target.value);
                }}
                className="w-full rounded-2xl border border-white/10 bg-ink-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {(provider === "openai"
                  ? OPENAI_MODELS
                  : provider === "gemini"
                    ? GEMINI_MODELS
                    : LOCAL_MODELS
                ).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label
              htmlFor="custom-model"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Custom model ID{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="custom-model"
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder={
                provider === "openai"
                  ? "e.g. gpt-4o-mini"
                  : provider === "gemini"
                    ? "e.g. gemini-2.0-flash"
                    : "e.g. openclaw/default"
              }
              className="w-full rounded-2xl border border-white/10 bg-ink-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              If set, this overrides the dropdown and is sent to the API as-is.
            </p>
          </div>
          <div className="mb-4">
            <label
              htmlFor="repo-url"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Application repo URL{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="repo-url"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/your-app"
              className="w-full rounded-2xl border border-white/10 bg-ink-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Public GitHub (
              <span className="font-medium text-slate-400">github.com</span>){" "}
              only: the server downloads a snapshot so the model can align Terraform,
              Docker, Helm, and CI workflows with your codebase. Optional{" "}
              <code className="rounded bg-white/5 px-1 py-0.5">GITHUB_TOKEN</code>{" "}
              on the server improves rate limits.
            </p>
          </div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Requirements
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={example}
            rows={5}
            className="w-full resize-y rounded-2xl border border-white/10 bg-ink-950/80 px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <motion.button
              type="button"
              disabled={loading}
              onClick={onAnalyze}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-dim to-accent px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-accent/25 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                  Analyzing…
                </>
              ) : (
                "Analyze with AI"
              )}
            </motion.button>
            <button
              type="button"
              onClick={() => setText(example)}
              className="text-sm text-slate-400 underline-offset-4 hover:text-accent hover:underline"
            >
              Load example
            </button>
          </div>
          {error && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-coral">{error}</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Cloud:{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5">
              OPENAI_API_KEY
            </code>
            ,{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5">
              GEMINI_API_KEY
            </code>{" "}
            (or{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5">
              GOOGLE_API_KEY
            </code>
            ). Local/offline: OpenAI-compatible server (e.g.{" "}
            <code className="rounded bg-white/5 px-1 py-0.5">ollama serve</code>
            ) — optional{" "}
            <code className="rounded bg-white/5 px-1 py-0.5">
              LOCAL_LLM_BASE_URL
            </code>
            ,{" "}
            <code className="rounded bg-white/5 px-1 py-0.5">LOCAL_LLM_MODEL</code>
            . Optional repo analysis uses{" "}
            <code className="rounded bg-white/5 px-1 py-0.5">GITHUB_TOKEN</code>.
            Without a cloud key for OpenAI/Gemini, a deterministic demo runs.
          </p>
        </motion.section>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
              className="flex flex-col gap-10"
            >
              {result._meta?.demo_mode && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                  Demo mode (no API call): configure{" "}
                  {result._meta?.provider === "gemini" ? (
                    <>
                      <code className="rounded bg-black/20 px-1">
                        GEMINI_API_KEY
                      </code>{" "}
                      or{" "}
                      <code className="rounded bg-black/20 px-1">
                        GOOGLE_API_KEY
                      </code>
                    </>
                  ) : (
                    <code className="rounded bg-black/20 px-1">
                      OPENAI_API_KEY
                    </code>
                  )}{" "}
                  on the server for live{" "}
                  {result._meta?.provider === "gemini" ? "Gemini" : "OpenAI"}{" "}
                  output, or use Local (offline) with Ollama.
                </div>
              )}

              <section className="grid gap-6 md:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-ink-900/30 p-6 backdrop-blur">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Interpretation
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {result.interpreted_requirements}
                  </p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4 border-t border-white/5 pt-3">
                      <dt className="text-slate-500">Environment</dt>
                      <dd className="font-medium capitalize text-accent-glow">
                        {result.environment}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-white/5 pt-3">
                      <dt className="text-slate-500">Region / deploy</dt>
                      <dd className="text-right text-slate-300">
                        {result.region_or_deployment_note}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className="rounded-2xl border border-white/10 bg-ink-900/30 p-6 backdrop-blur">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Scale &amp; cost
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {result.availability_and_scaling_summary}
                  </p>
                  <p className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
                    {result.cost_summary}
                  </p>
                </article>
              </section>

              <section>
                <h2 className="mb-4 font-display text-xl font-semibold text-white">
                  Resource topology
                </h2>
                <TopologyPanel
                  resources={result.resources}
                  edges={result.edges}
                />
              </section>

              <section>
                <h2 className="mb-4 font-display text-xl font-semibold text-white">
                  Recommended resources
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {result.resources.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/80 to-ink-950/80 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {r.type}
                      </p>
                      <p className="font-display font-semibold text-white">{r.name}</p>
                      <p className="mt-1 text-xs text-accent">{r.provider_service}</p>
                      <p className="mt-2 text-sm text-slate-400">{r.description}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {r.sizing_rationale}
                      </p>
                      {r.estimated_monthly_usd != null && (
                        <p className="mt-2 text-sm font-medium text-coral">
                          ~${r.estimated_monthly_usd.toFixed(0)}/mo est.
                        </p>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </section>

              {result.risk_notes && result.risk_notes.length > 0 && (
                <section className="rounded-2xl border border-coral/25 bg-coral/5 p-6">
                  <h2 className="font-display text-lg font-semibold text-coral">
                    Risks &amp; follow-ups
                  </h2>
                  <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
                    {result.risk_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </section>
              )}

              {(result.supplemental_files?.length ?? 0) > 0 && (
                <section className="rounded-2xl border border-white/10 bg-ink-900/30 p-6 backdrop-blur">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Delivery artifacts
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Docker, Helm, GitHub Actions, or other non-Terraform files
                    generated from your requirements
                    {result._meta?.repo_url ? " and repository snapshot" : ""}.
                  </p>
                  <ul className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/5 bg-ink-950/50 px-3 py-2 font-mono text-xs text-slate-400">
                    {result.supplemental_files!.map((f) => (
                      <li key={f.path} className="py-1">
                        {f.path}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="flex flex-col gap-5 rounded-2xl border border-accent/20 bg-accent/5 p-6">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Download bundle &amp; follow-up steps
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    The archive is organized into folders: root{" "}
                    <code className="rounded bg-white/10 px-1 text-accent">SETUP.md</code>{" "}
                    (step-by-step guide),{" "}
                    <code className="rounded bg-white/10 px-1 text-accent">terraform/</code> for
                    all <code className="text-slate-500">*.tf</code> and tfvars examples,{" "}
                    <code className="rounded bg-white/10 px-1 text-accent">docker/</code> for
                    Dockerfiles / compose,{" "}
                    <code className="rounded bg-white/10 px-1 text-accent">delivery/</code> for
                    other generated files, and preserved{" "}
                    <code className="rounded bg-white/10 px-1 text-accent">.github/workflows/</code>{" "}
                    / <code className="rounded bg-white/10 px-1 text-accent">helm/</code> paths when
                    the model created them. This run:{" "}
                    <span className="text-slate-300">
                      {result.terraform_files.length} Terraform file(s)
                      {(result.supplemental_files?.length ?? 0) > 0
                        ? `, ${result.supplemental_files!.length} supplemental file(s)`
                        : ""}
                    </span>
                    .
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-300">
                    Quick steps (details in <code className="text-accent">SETUP.md</code> inside the
                    ZIP)
                  </h3>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                    <li>
                      Click <span className="text-white">Download .zip</span> and extract the
                      archive.
                    </li>
                    <li>
                      Open <code className="rounded bg-white/10 px-1">SETUP.md</code> first — it
                      matches this bundle and walks through Terraform, Docker, Helm, and CI in
                      order.
                    </li>
                    <li>
                      Run Terraform from <code className="rounded bg-white/10 px-1">terraform/</code>
                      : copy tfvars example, then{" "}
                      <code className="rounded bg-white/10 px-1">terraform init</code>,{" "}
                      <code className="rounded bg-white/10 px-1">plan</code>, and only then{" "}
                      <code className="rounded bg-white/10 px-1">apply</code>.
                    </li>
                    <li>
                      Copy <code className="rounded bg-white/10 px-1">.github/</code> into your real
                      app repo root if you use those workflows; build images using files under{" "}
                      <code className="rounded bg-white/10 px-1">docker/</code> as needed.
                    </li>
                  </ol>
                </div>
                <div className="flex justify-start md:justify-end">
                  <motion.button
                    type="button"
                    onClick={onDownload}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl border border-accent/40 bg-ink-900 px-5 py-3 text-sm font-semibold text-accent-glow shadow-lg transition hover:bg-accent/10"
                  >
                    Download .zip
                  </motion.button>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
