import type { AiProvider } from "./aiOptions";
import type { AnalyzeResponse, TerraformFile } from "./types";

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
): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, provider, model }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<AnalyzeResponse>;
}

export async function downloadTerraformZip(files: TerraformFile[]): Promise<void> {
  const res = await fetch("/api/terraform-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nlp-to-infra-terraform.zip";
  a.click();
  URL.revokeObjectURL(url);
}
