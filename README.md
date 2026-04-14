# NLP → Infra

Web app: describe hosting requirements in plain language, get AI-backed resource recommendations, an interactive topology diagram, and a Terraform bundle as a ZIP.

## Prerequisites

- Node.js 20+
- Optional LLM keys (configure at least one you plan to use in the UI):
  - [OpenAI](https://platform.openai.com/) — `OPENAI_API_KEY` (optional defaults: `OPENAI_MODEL`)
  - [Google AI (Gemini)](https://ai.google.dev/) — `GEMINI_API_KEY` or `GOOGLE_API_KEY` (optional defaults: `GEMINI_MODEL`)
  - **Local (offline)** — optional API key depending on the server. **Ollama** (default `http://127.0.0.1:11434/v1`): use the model id from `ollama list` even if you also use OpenClaw TUI (TUI does not move Ollama’s HTTP API to port 18789). **OpenClaw Gateway** on :18789: enable `gateway.http.endpoints.chatCompletions` first or `/v1/chat/completions` returns 404/405; model `openclaw/default`; set `LOCAL_LLM_API_KEY` to the gateway bearer token when required. [LM Studio](https://lmstudio.ai/) works if it exposes `/v1/chat/completions`. Env: `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_API_KEY`.

If the selected cloud provider has no key, the server returns a deterministic demo response. Local always calls your server (no demo fallback).

## Setup

```bash
npm run install:all
```

Copy `.env.example` to **either the repo root** (`.env` next to `package.json`) or **`server/.env`**. The API loads both (root first, then `server/` overrides). Set API keys as needed. The web UI lets you pick **OpenAI, Gemini, or Local (offline)** and the **model** per request.

## Development

Terminal 1 — API (default port 8787):

```bash
cd server
npm run dev
```

Terminal 2 — UI (Vite proxies `/api` to the server):

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

## Production-style single port

Build the client and server, then from the `server` folder run Node with `CLIENT_DIST` pointing at the Vite output (path is relative to `server/`):

```bash
cd client && npm run build
cd ../server && npm run build
```

Windows (PowerShell or cmd):

```bat
set CLIENT_DIST=..\client\dist
set PORT=8787
node dist\index.js
```

Unix:

```bash
CLIENT_DIST=../client/dist PORT=8787 node dist/index.js
```

Open `http://localhost:8787`.

## API

- `GET /api/config` — `{ openai_configured, gemini_configured, local_configured }` (keys present for cloud; local is always offered).
- `POST /api/analyze` — body `{ "text": "...", "provider": "openai" | "gemini" | "local", "model": "..." }` → JSON analysis + `terraform_files`. `model` may be omitted; server uses env defaults.
- `POST /api/terraform-zip` — body `{ "files": [{ "path": "...", "content": "..." }] }` → ZIP download.

Terraform is a starting point: set VPC, subnets, ACM, ECR images, and secrets before applying in a real account. The model is instructed to emit **multiple `.tf` files** (e.g. `alb.tf`, `ecs.tf`, `rds.tf`, `iam_ecs.tf`) instead of one large `main.tf`.
