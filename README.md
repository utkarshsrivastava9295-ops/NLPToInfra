# NLP → Infra

**Natural language → architecture → Terraform**

Describe hosting needs in plain language. The app returns an AI-backed interpretation, an interactive **resource topology** graph, line-item **recommendations with rough costs**, **risks and follow-ups**, and a **Terraform bundle** (ZIP) you can refine before `terraform apply`.

---

## Example walkthrough (sample)

Below is the same flow illustrated in the screenshots under [`docs/images/`](docs/images/).

### 1. Input: provider, model, and requirements

Pick **OpenAI**, **Gemini**, or **Local (offline)**; choose a model (or override with a custom model id). Paste requirements and click **Analyze with AI**.

![Input form: provider, model, requirements](docs/images/ui-input.png)

**Sample prompt** (also available via *Load example* in the UI):

> I have a web app: Node.js frontend and Python FastAPI backend with PostgreSQL. Expect roughly 50k daily users, need high availability in production, budget around $400/month, region us-east-1.

### 2. Interpretation, scale & cost, and topology

The response summarizes **environment** (e.g. production), **region**, **HA and scaling** (multi-AZ, ALB, ECS Fargate autoscaling, health checks), and a **cost narrative** aligned with your budget. The **resource topology** shows how traffic flows (e.g. users → ALB → ECS → Redis / RDS).

![Topology and interpretation overview](docs/images/topology.png)

### 3. Recommended resources

Each node becomes a card: service type, AWS (or other) product, rationale, and optional **~$/month** estimates.

![Recommended resources and cost cards](docs/images/resources.png)

*Example line items from the sample above:*

| Area        | Focus                         | Example service        | ~Est. / mo |
|------------|--------------------------------|-------------------------|------------|
| Actor      | External traffic (~50k DAU)   | Public internet         | —          |
| Networking | HA, multi-AZ distribution     | Application Load Balancer | ~$30     |
| Compute    | Frontend + API containers     | ECS Fargate             | ~$150      |
| Database   | Managed PostgreSQL, Multi-AZ  | Amazon RDS              | ~$180      |
| Caching    | Sessions / hot reads          | ElastiCache (Redis)     | ~$40       |

Figures are **ballpark**; treat them as planning hints, not invoices.

### 4. Risks & follow-ups and Terraform bundle

**Risks** might call out a tight budget for full HA, the need to tune **CPU/memory** on tasks, or **DB connection pooling** in application code.

The **Terraform bundle** lists how many files were generated. Use **Download .zip**, then fill `terraform.tfvars`, wire **VPC, subnets, ACM, and container images**, and run `terraform init` / `plan` before apply.

![Risks and Terraform download](docs/images/terraform-bundle.png)

Terraform is generated as **multiple `.tf` files** by concern (for example `providers.tf`, `variables.tf`, `alb.tf`, `ecs.tf`, `rds.tf`, `elasticache.tf`, `iam_ecs.tf`, `outputs.tf`) rather than one giant `main.tf`. File count varies with the architecture the model proposes.

---

## Prerequisites

- **Node.js 20+**
- At least one analysis backend (the UI lets you choose per request).

| Mode | Purpose | Environment variables |
|------|---------|----------------------|
| **OpenAI** | Hosted models | `OPENAI_API_KEY`, optional `OPENAI_MODEL` |
| **Gemini** | Google AI | `GEMINI_API_KEY` or `GOOGLE_API_KEY`, optional `GEMINI_MODEL` |
| **Local** | Offline / self-hosted | `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_API_KEY` |

**Local tips**

- **Ollama** — default API base is `http://127.0.0.1:11434/v1`. Model id must match `ollama list` (e.g. `gemma4:latest`). OpenClaw TUI using Ollama does **not** move that API to port `18789`.
- **OpenClaw Gateway** on `:18789` — enable HTTP chat completions or `/v1/chat/completions` may 404/405. Model ids such as `openclaw/default`. Set `LOCAL_LLM_API_KEY` to the gateway bearer token when auth requires it.
- **LM Studio** — use its OpenAI-compatible base URL (usually ending in `/v1`).

If **OpenAI** or **Gemini** is selected but the server has **no key** for that provider, the API returns a **deterministic demo** (like the multi-file mock in the repo). **Local** always hits your server (no demo fallback).

---

## Setup

```bash
npm run install:all
```

Copy `.env.example` to **the repo root** (`.env` next to `package.json`) and/or **`server/.env`**. The server loads both (root first, then `server/` overrides).

---

## Development

**Terminal 1 — API** (default `8787`):

```bash
cd server
npm run dev
```

**Terminal 2 — UI** (Vite proxies `/api` to the server):

```bash
cd client
npm run dev
```

Open **http://localhost:5173**.

---

## Production-style single port

```bash
cd client && npm run build
cd ../server && npm run build
```

**Windows (PowerShell or cmd):**

```bat
set CLIENT_DIST=..\client\dist
set PORT=8787
node dist\index.js
```

**Unix:**

```bash
CLIENT_DIST=../client/dist PORT=8787 node dist/index.js
```

Open **http://localhost:8787**.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/config` | `openai_configured`, `gemini_configured`, `local_configured` |
| `POST` | `/api/analyze` | Body: `{ "text", "provider": "openai" \| "gemini" \| "local", "model"? }` → analysis JSON + `terraform_files` |
| `POST` | `/api/terraform-zip` | Body: `{ "files": [{ "path", "content" }] }` → ZIP download |

---

## Disclaimer

Generated Terraform and cost figures are **starting points**. You must validate networking, security, sizing, and compliance in your own account before production use.
