import type { AiProvider } from "./aiOptions";
import type { AnalyzeResponse } from "./types";

export async function fetchApiConfig(): Promise<{
  openai_configured: boolean;
  gemini_configured: boolean;
  local_configured?: boolean;
}> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Config request failed");
  return res.json();
}

export async function analyze(
  text: string,
  provider: AiProvider,
  model: string,
  repoUrl?: string,
): Promise<AnalyzeResponse> {
  const trimmedRepo = repoUrl?.trim();
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      provider,
      model,
      ...(trimmedRepo ? { repo_url: trimmedRepo } : {}),
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<AnalyzeResponse>;
}

/**
 * ZIP uses a structured layout: SETUP.md, terraform/, docker/, delivery/, .github/, helm/, etc.
 */
export async function downloadInfraBundle(
  response: AnalyzeResponse,
  downloadName = "nlp-to-infra-bundle.zip",
): Promise<void> {
  const res = await fetch("/api/terraform-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layout: "structured",
      terraform_files: response.terraform_files,
      supplemental_files: response.supplemental_files ?? [],
    }),
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.click();
  URL.revokeObjectURL(url);
}
