import { z } from "zod";

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
  estimated_monthly_usd: z.number().optional(),
  provider_service: z.string(),
});

export const InfraEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
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
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
