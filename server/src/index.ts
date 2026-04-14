import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeRequirements } from "./analyze.js";
import { parseProvider } from "./modelIds.js";
import { parseZipBody, streamTerraformZip } from "./zipTerraform.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverDir, "..");

// Default dotenv only reads CWD — load monorepo root + server/.env explicitly.
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(serverDir, ".env") });
dotenv.config();

function geminiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({
    openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    gemini_configured: Boolean(geminiKey()),
    /** Local / offline: no API key; uses LOCAL_LLM_BASE_URL (default Ollama). */
    local_configured: true,
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (!text.trim()) {
      res.status(400).json({ error: "Missing text" });
      return;
    }
    const provider = parseProvider(req.body?.provider);
    const model =
      typeof req.body?.model === "string" ? req.body.model : undefined;
    const repo_url =
      typeof req.body?.repo_url === "string" ? req.body.repo_url : undefined;

    const { data, resolvedProvider, resolvedModel, demo_mode } =
      await analyzeRequirements(
        text,
        { provider, model, repoUrl: repo_url },
        {
          openai: process.env.OPENAI_API_KEY,
          gemini: geminiKey(),
        },
      );

    res.json({
      ...data,
      _meta: {
        demo_mode,
        provider: resolvedProvider,
        model: resolvedModel,
        repo_url: repo_url?.trim() || undefined,
        openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        gemini_configured: Boolean(geminiKey()),
        local_configured: true,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/terraform-zip", async (req, res) => {
  const parsed = parseZipBody(req.body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    res.status(400).json({
      error: `Invalid body: ${detail}. Send { layout?, terraform_files?, supplemental_files? } or legacy { files }.`,
    });
    return;
  }
  if (!parsed.data.files.length) {
    res.status(400).json({ error: "No files" });
    return;
  }
  try {
    await streamTerraformZip(res, parsed.data.files);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Zip failed";
    if (!res.headersSent) res.status(500).json({ error: message });
  }
});

const clientDist = process.env.CLIENT_DIST?.trim();
if (clientDist) {
  const abs = path.isAbsolute(clientDist)
    ? clientDist
    : path.resolve(__dirname, "..", clientDist);
  app.use(express.static(abs));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(abs, "index.html"));
  });
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
