export type InfraResource = {
  id: string;
  name: string;
  type: string;
  description: string;
  sizing_rationale: string;
  estimated_monthly_usd?: number;
  provider_service: string;
};

export type InfraEdge = {
  from: string;
  to: string;
  label?: string;
};

export type TerraformFile = {
  path: string;
  content: string;
};

export type AnalyzeResponse = {
  interpreted_requirements: string;
  environment: string;
  region_or_deployment_note: string;
  availability_and_scaling_summary: string;
  cost_summary: string;
  resources: InfraResource[];
  edges: InfraEdge[];
  risk_notes?: string[];
  terraform_files: TerraformFile[];
  /** Dockerfile, Helm, GitHub Actions, etc. (when repo URL was used or model emits them). */
  supplemental_files?: TerraformFile[];
  _meta?: {
    demo_mode?: boolean;
    provider?: "openai" | "gemini" | "local";
    model?: string;
    repo_url?: string;
    openai_configured?: boolean;
    gemini_configured?: boolean;
    local_configured?: boolean;
  };
};
