import AdmZip from "adm-zip";

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

const TEXT_EXTENSIONS = new Set([
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".md",
  ".mod",
  ".sum",
  ".gradle",
  ".kts",
  ".xml",
  ".properties",
  ".env",
  ".example",
  ".sh",
  ".dockerfile",
]);

const PRIORITY_BASENAMES = new Set([
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".dockerignore",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "pipfile",
  "poetry.lock",
  "go.mod",
  "go.sum",
  "cargo.toml",
  "cargo.lock",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.ts",
  "vite.config.js",
  "nuxt.config.ts",
  "angular.json",
  "chart.yaml",
  "values.yaml",
]);

function looksTextualPath(rel: string): boolean {
  const lower = rel.toLowerCase();
  if (PRIORITY_BASENAMES.has(lower.split("/").pop() || "")) return true;
  if (lower.includes("dockerfile")) return true;
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (lower.startsWith(".github/workflows/") && (lower.endsWith(".yml") || lower.endsWith(".yaml")))
    return true;
  if (lower.includes("/helm/") || lower.startsWith("helm/") || lower.includes("/charts/"))
    return true;
  return false;
}

function isProbablyText(buf: Buffer, maxCheck = 8000): boolean {
  const slice = buf.subarray(0, Math.min(buf.length, maxCheck));
  let bad = 0;
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!;
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32 && b !== 27)) bad++;
  }
  return bad < slice.length * 0.02;
}

export type ParsedGithubRepo = {
  owner: string;
  repo: string;
};

export function parseGithubRepoUrl(raw: string): ParsedGithubRepo | null {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!GITHUB_HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  let repo = parts[1]!;
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}

async function githubDefaultBranch(
  owner: string,
  repo: string,
  token?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "NLPToInfra/1.0",
  };
  const t = token?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(
      `GitHub repo metadata HTTP ${res.status} (is the repo public and the URL correct?)`,
    );
  }
  const j = (await res.json()) as { default_branch?: string };
  return j.default_branch || "main";
}

function stripZipRoot(entryName: string): string | null {
  const normalized = entryName.replace(/\\/g, "/");
  const idx = normalized.indexOf("/");
  if (idx === -1) return null;
  return normalized.slice(idx + 1);
}

/**
 * Fetches a public GitHub repository zipball and returns a text summary for the LLM (file tree + key manifests).
 */
export async function fetchGithubRepoContext(repoUrl: string): Promise<string> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error(
      "Unsupported repository URL. Use a public https://github.com/owner/repo URL.",
    );
  }

  const maxZipMb = Number(process.env.REPO_ZIP_MAX_MB) || 20;
  const maxZipBytes = maxZipMb * 1024 * 1024;
  const maxFileBytes = Number(process.env.REPO_FILE_MAX_BYTES) || 96_000;
  const maxTotalChars = Number(process.env.REPO_CONTEXT_MAX_CHARS) || 95_000;
  const timeoutMs = Number(process.env.REPO_FETCH_TIMEOUT_MS) || 45_000;
  const token = process.env.GITHUB_TOKEN?.trim();

  const branch = await githubDefaultBranch(
    parsed.owner,
    parsed.repo,
    token,
  );

  const zipUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/refs/heads/${branch}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(zipUrl, {
      signal: ac.signal,
      headers: {
        "User-Agent": "NLPToInfra/1.0",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(
      `Failed to download repository archive (HTTP ${res.status}). Try a branch that exists, or set GITHUB_TOKEN for private repos.`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxZipBytes) {
    throw new Error(`Repository archive exceeds ${maxZipMb} MB limit.`);
  }

  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const paths: string[] = [];
  const entryByRel = new Map<string, (typeof entries)[number]>();

  for (const e of entries) {
    if (e.isDirectory) continue;
    const rel = stripZipRoot(e.entryName);
    if (!rel || rel.length === 0) continue;
    paths.push(rel);
    entryByRel.set(rel, e);
  }
  paths.sort();
  const treeLines = paths.slice(0, 400).join("\n");
  const treeSection =
    paths.length > 400
      ? `${treeLines}\n... and ${paths.length - 400} more paths`
      : treeLines;

  const chunks: string[] = [];
  chunks.push(
    `GitHub repository: ${parsed.owner}/${parsed.repo} (branch ${branch}, ${paths.length} files in archive).`,
  );
  chunks.push("\n## File tree (sample / truncated)\n");
  chunks.push(treeSection);

  let usedChars = chunks.join("\n").length;

  const candidates = paths.filter((p) => looksTextualPath(p));
  /** Prefer shallow, well-known manifests first */
  candidates.sort((a, b) => {
    const depth = (s: string) => s.split("/").length;
    return depth(a) - depth(b) || a.length - b.length;
  });

  for (const rel of candidates) {
    if (usedChars >= maxTotalChars) break;
    const entry = entryByRel.get(rel);
    if (!entry) continue;
    const data = entry.getData();
    if (data.length > maxFileBytes) continue;
    if (!isProbablyText(data)) continue;
    let text: string;
    try {
      text = data.toString("utf8");
    } catch {
      continue;
    }
    const header = `\n## File: ${rel}\n\`\`\`\n`;
    const footer = `\n\`\`\`\n`;
    const slice =
      text.length > maxFileBytes ? text.slice(0, maxFileBytes) + "\n…(truncated)" : text;
    const block = header + slice + footer;
    if (usedChars + block.length > maxTotalChars) break;
    chunks.push(block);
    usedChars += block.length;
  }

  chunks.push(
    "\n---\nUse the tree and file contents above to align Dockerfiles, Helm, CI/CD, and Terraform image names with the real stack.",
  );

  return chunks.join("\n");
}
