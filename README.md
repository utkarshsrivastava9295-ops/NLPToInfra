# NLP → Infra

Turn **natural language** plus an **optional GitHub repo URL** into a structured bundle: **Terraform** (multi-file AWS-style layouts), **topology** and **cost-style recommendations**, **risks & follow-ups**, and **delivery artifacts** (Docker, Helm, GitHub Actions, etc.)—packaged as a **ZIP** with **`SETUP.md`** and folders (`terraform/`, `docker/`, `delivery/`, `.github/`, `helm/`).

Screenshots in this README live under [`docs/images/`](docs/images/) (UI, results, download panel, and **sample ZIP / archive output**).

---

## What you do in the UI

### Inputs: repo URL, requirements, and provider

Pick **OpenAI**, **Gemini**, or **Local (offline)**, choose a **model** (or a **custom model id**). Optionally paste a **public GitHub** HTTPS URL so the server downloads a snapshot and aligns Terraform, Docker, Helm, and CI with your tree. Enter **requirements** in plain language (from a one-liner like “complete infra” to a full production brief).

![Application repo URL, requirements, Analyze with AI](docs/images/ui-repo-requirements.png)

The footer reminds you which **environment variables** power each mode:

- **Cloud:** `OPENAI_API_KEY`, `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- **Local:** e.g. `ollama serve` with `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`
- **Repo analysis:** optional `GITHUB_TOKEN` on the server for rate limits and private repos

Without a cloud key for the selected provider, the server runs a **deterministic demo** instead of calling OpenAI/Gemini. **Local** always calls your configured endpoint.

### After analysis: risks, delivery files, and download

The app surfaces **Risks & follow-ups** (security, secrets, sizing—example themes below) and lists **non-Terraform** paths under **Delivery artifacts** when the model generates them.

![Risks & follow-ups and delivery artifacts](docs/images/risks-delivery-artifacts.png)

Typical themes you may see under **Risks & follow-ups** (illustrative):

- **Security groups:** ALB exposed on 80/443 from the internet; ECS, RDS, and cache tiers restricted to the ALB or VPC CIDR—not wide open.
- **Secrets:** Prefer **AWS Secrets Manager** (or equivalent) for DB credentials and API keys instead of long-lived plaintext in env vars or task definitions.
- **Fargate / compute:** Right-size **CPU and memory** so you neither starve the app nor overpay.

**Delivery artifacts** can include paths such as:

- `Dockerfile`
- `.github/workflows/ci-cd.yml`

…and Helm charts or other files depending on your prompt and repo context.

### Download bundle and follow-up steps

The **Download bundle & follow-up steps** panel explains how the **ZIP** is laid out and gives a short checklist. The same detail appears as **`SETUP.md`** at the root of the archive.

![Download bundle layout and quick steps](docs/images/download-bundle-steps.png)

**Inside the ZIP (structured layout):**

| Location | Purpose |
|----------|---------|
| `SETUP.md` | Full step-by-step: Terraform, Docker, Helm, CI |
| `terraform/` | All `*.tf` files and tfvars examples |
| `docker/` | Dockerfiles, compose files, `.dockerignore` |
| `delivery/` | Other generated assets |
| `.github/workflows/` | Preserved so you can copy `.github/` to your app repo root |
| `helm/` (if present) | Helm charts |

### Example: downloaded ZIP (archive / extracted layout)

This is what a real **`nlp-to-infra-bundle.zip`** looks like in an archive tool after download: root **`SETUP.md`** (step-by-step instructions), **`terraform/`** for all `.tf` and tfvars files, **`docker/`** for Docker-related assets, and **`.github/`** for GitHub Actions workflows. Larger runs may also include **`delivery/`** or **`helm/`**.

![Example ZIP contents: SETUP.md, .github, docker, terraform](docs/images/zip-output-structure.png)

A typical run might report something like **“10 Terraform file(s), 2 supplemental file(s)”** before you click **Download .zip**.

**Quick steps (also in the UI and in `SETUP.md`):**

1. Download and extract the ZIP.
2. Open **`SETUP.md`** first—it matches the bundle.
3. From **`terraform/`**: copy the tfvars example, then `terraform init`, `plan`, and only then `apply`.
4. Copy **`.github/`** into your real repository root if you use those workflows; build images using **`docker/`** as needed.

---

## Step-by-step: install and run

### 1. Prerequisites

- **Node.js 20+**
- At least one analysis backend: **OpenAI**, **Gemini**, or **local** OpenAI-compatible server (see `.env.example`).

### 2. Install

```bash
npm run install:all
```

### 3. Configure

Copy `.env.example` to **`.env`** (repo root and/or `server/.env`). Set provider keys and, if you use **repo URL** analysis heavily, **`GITHUB_TOKEN`**.

Optional tuning (see `.env.example`): `ANALYZE_CONTEXT_MAX_CHARS`, `LOCAL_LLM_MAX_TOKENS`, `REPO_*` limits.

### 4. Run API + UI

**Terminal 1 — API** (default port **8787**):

```bash
cd server
npm run dev
```

**Terminal 2 — UI:**

```bash
cd client
npm run dev
```

Open **http://localhost:5173**.

### 5. Production single port

```bash
cd client && npm run build
cd ../server && npm run build
```

**Windows:** `set CLIENT_DIST=..\client\dist` then `node dist\index.js` from `server/`.  
**Unix:** `CLIENT_DIST=../client/dist PORT=8787 node dist/index.js`  
Open **http://localhost:8787**.

---

## Optional: GitHub repository URL

| Topic | Detail |
|--------|--------|
| **Format** | `https://github.com/owner/repo` (e.g. a real app you deploy). `www.github.com` and optional `.git` suffix are fine. |
| **Scope** | Public repos work without a token; **`GITHUB_TOKEN`** helps rate limits and **private** repos. |
| **Fetch** | Default branch zip + file tree and key manifests (package files, Docker, workflows, Helm, etc.), within size limits. |
| **Not fetched in-app** | GitLab / Bitbucket / arbitrary hosts—you can still describe the stack in **Requirements**. |
| **ZIP** | Server builds a **structured** archive: `SETUP.md`, `terraform/`, `docker/`, `delivery/`, plus preserved `.github/` and `helm/` paths. |

---

## API

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/config` | Provider configuration flags |
| `POST` | `/api/analyze` | `{ "text", "provider": "openai" \| "gemini" \| "local", "model"?, "repo_url"? }` → `terraform_files`, `supplemental_files`, graph, summaries |
| `POST` | `/api/terraform-zip` | `{ "layout": "structured", "terraform_files", "supplemental_files" }` → ZIP. Legacy `{ "files", "layout": "flat"? }` supported |

**Example (analyze with repo):**

```bash
curl -sS -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"complete infra","provider":"openai","model":"gpt-4o-mini","repo_url":"https://github.com/org/your-app"}'
```

(Windows: use `^` instead of `\` for line continuation.)

---

## Limits and safety

- **SSRF:** Only **github.com** is used for `repo_url` fetches.
- **Secrets:** Treat generated workflows and Terraform as templates; wire real secrets via your platform (e.g. GitHub Actions secrets, OIDC to AWS).
- **Quality:** All outputs are **starting points**—review HCL, Docker, Helm, and network boundaries before production.

Terraform is generated as **multiple files by concern** (e.g. `alb.tf`, `ecs.tf`, `rds.tf`, `iam_ecs.tf`), not a single oversized `main.tf`.
