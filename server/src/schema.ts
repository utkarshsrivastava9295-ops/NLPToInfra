import { z } from "zod";

/** LLMs often emit null for optional fields; JSON has no undefined. */
function optionalNumber() {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
      const n = Number(val);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  }, z.number().optional());
}

function optionalString() {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string" && val.trim() === "") return undefined;
    return val;
  }, z.string().optional());
}

export const TerraformFileSchema = z.object({
  path: z
    .string()
    .describe(
      "Relative path; split Terraform by concern (e.g. alb.tf, ecs.tf, rds.tf, iam_ecs.tf) — avoid a single main.tf for the whole stack.",
    ),
  content: z.string(),
});

export const InfraResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  sizing_rationale: z.string(),
  estimated_monthly_usd: optionalNumber(),
  provider_service: z.string(),
});

export const InfraEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: optionalString(),
});

/** Dockerfile, Helm, CI workflows, etc. — not Terraform. */
export const SupplementalFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const AnalysisResultSchema = z.object({
  interpreted_requirements: z.string(),
  environment: z.string(),
  region_or_deployment_note: z.string(),
  availability_and_scaling_summary: z.string(),
  cost_summary: z.string(),
  resources: z.array(InfraResourceSchema),
  edges: z.array(InfraEdgeSchema),
  risk_notes: z.array(z.string()).optional(),
  terraform_files: z.array(TerraformFileSchema),
  /** When a repo URL was provided: Docker, Helm, GitHub Actions / GitLab CI, etc. */
  supplemental_files: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(SupplementalFileSchema),
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
