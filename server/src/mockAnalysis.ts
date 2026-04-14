import type { AnalysisResult } from "./schema.js";

/** Deterministic fallback when the selected provider has no API key (demo / local dev). */
export function mockAnalysis(userText: string): AnalysisResult {
  const prod =
    /\b(prod|production|high availability|ha\b|zero downtime|sla|24\/7)\b/i.test(
      userText,
    );
  const budgetMatch = userText.match(/\$?\s*(\d{2,5})\s*(usd|\$)?/i);
  const budget = budgetMatch ? Number(budgetMatch[1]) : 150;

  const region =
    /\b(us-east-1|eu-west-1|ap-south-1|us-west-2|region\s*[:\s]+\S+)/i.test(
      userText,
    )
      ? "Inferred or user-specified region — set var.aws_region in Terraform."
      : "No region stated; defaulting to us-east-1 in Terraform variables.";

  const resources: AnalysisResult["resources"] = [
    {
      id: "users",
      name: "Internet users",
      type: "actor",
      description: "External traffic to your application.",
      sizing_rationale: "Entry point for all requests.",
      provider_service: "Public internet",
    },
    {
      id: "cdn",
      name: "CDN / static assets",
      type: "cdn",
      description: "Caches static frontend assets at the edge.",
      sizing_rationale: prod
        ? "Production: CloudFront reduces origin load and improves TTFB globally."
        : "Optional for dev; recommended for prod.",
      estimated_monthly_usd: Math.min(25, Math.max(5, budget * 0.05)),
      provider_service: "AWS CloudFront + S3",
    },
    {
      id: "alb",
      name: "Application load balancer",
      type: "load_balancer",
      description: "TLS termination, routing, health checks.",
      sizing_rationale: prod
        ? "ALB across AZs for HA and rolling deployments."
        : "Single ALB acceptable for lower environments.",
      estimated_monthly_usd: 20,
      provider_service: "AWS Application Load Balancer",
    },
    {
      id: "fe",
      name: "Frontend (Node SSR or static)",
      type: "compute",
      description: "Serves UI; Node build output or SSR service.",
      sizing_rationale: `Scaled task count tuned toward ~${budget}$/mo budget.`,
      estimated_monthly_usd: Math.min(80, Math.max(20, budget * 0.25)),
      provider_service: "AWS ECS Fargate",
    },
    {
      id: "api",
      name: "API (Python FastAPI)",
      type: "compute",
      description: "REST/JSON API behind the load balancer.",
      sizing_rationale: prod
        ? "Separate service from frontend for independent scaling."
        : "Can share cluster with smaller task count.",
      estimated_monthly_usd: Math.min(90, Math.max(25, budget * 0.3)),
      provider_service: "AWS ECS Fargate",
    },
    {
      id: "db",
      name: "Managed database",
      type: "database",
      description: "Persistent relational data with backups.",
      sizing_rationale: prod
        ? "Multi-AZ RDS for failover; automated backups."
        : "Single-AZ smaller instance for cost.",
      estimated_monthly_usd: Math.min(120, Math.max(30, budget * 0.35)),
      provider_service: "AWS RDS PostgreSQL",
    },
    {
      id: "cache",
      name: "Redis cache (optional)",
      type: "cache",
      description: "Session and hot read offload.",
      sizing_rationale: prod
        ? "ElastiCache reduces DB pressure under load."
        : "Skip or use small node for dev.",
      estimated_monthly_usd: prod ? 40 : 0,
      provider_service: "AWS ElastiCache Redis",
    },
    {
      id: "secrets",
      name: "Secrets manager",
      type: "security",
      description: "API keys and DB credentials rotation.",
      sizing_rationale: "Avoid plaintext secrets in task definitions.",
      estimated_monthly_usd: 5,
      provider_service: "AWS Secrets Manager",
    },
  ];

  const edges: AnalysisResult["edges"] = [
    { from: "users", to: "cdn", label: "HTTPS" },
    { from: "cdn", to: "alb", label: "Origin" },
    { from: "users", to: "alb", label: "API / dynamic" },
    { from: "alb", to: "fe", label: "HTTP" },
    { from: "alb", to: "api", label: "HTTP" },
    { from: "api", to: "db", label: "SQL" },
    { from: "api", to: "cache", label: "Redis" },
    { from: "api", to: "secrets", label: "read" },
  ];

  if (!prod) {
    const filtered = resources.filter((r) => r.id !== "cache");
    const rids = new Set(filtered.map((r) => r.id));
    return {
      interpreted_requirements:
        "Demo mode (no API key for selected provider): interpreted as a non-production style stack with cost focus.",
      environment: "development",
      region_or_deployment_note: region,
      availability_and_scaling_summary:
        "Single-AZ leaning layout; scale ECS tasks manually or with target tracking when you move to prod.",
      cost_summary: `Rough monthly ballpark aligned with ~$${budget} budget; refine with AWS Pricing Calculator.`,
      resources: filtered,
      edges: edges.filter(
        (e) => rids.has(e.from) && rids.has(e.to),
      ),
      risk_notes: [
        "This is static mock output. Set OPENAI_API_KEY or GEMINI_API_KEY for AI-driven sizing and Terraform.",
      ],
      terraform_files: buildMockTerraform(prod, budget),
    };
  }

  return {
    interpreted_requirements:
      "Demo mode (no API key for selected provider): interpreted as production-oriented with HA assumptions.",
    environment: "production",
    region_or_deployment_note: region,
    availability_and_scaling_summary:
      "ALB across AZs, ECS services with min capacity ≥2 per critical service where budget allows, RDS Multi-AZ recommended.",
    cost_summary: `Estimates scale with stated budget ~$${budget}/mo; validate in AWS Pricing Calculator.`,
    resources,
    edges,
    risk_notes: [
      "Mock Terraform is illustrative; replace container images, subnets, and ACM ARNs before apply.",
    ],
    terraform_files: buildMockTerraform(prod, budget),
  };
}

function buildMockTerraform(prod: boolean, budget: number): AnalysisResult["terraform_files"] {
  const multiAz = prod ? "true" : "false";
  const feCount = prod ? 2 : 1;
  const apiCount = prod ? 2 : 1;
  const dbClass = prod ? "db.t4g.small" : "db.t4g.micro";
  return [
    {
      path: "README.md",
      content: `# Generated stack (demo/mock)

1. Copy \`terraform.tfvars.example\` to \`terraform.tfvars\` and fill values.
2. \`terraform init\` && \`terraform plan\`
3. This is a **starter** layout: wire your VPC, subnets, ECR images, and ACM certificate.

Terraform files: \`providers.tf\`, \`variables.tf\`, \`alb.tf\`, \`ecs.tf\`, \`iam_ecs.tf\`, \`rds.tf\`, \`outputs.tf\` (no monolithic \`main.tf\`).

Budget hint used: ~$${budget}/mo. Multi-AZ RDS: ${multiAz}.
`,
    },
    {
      path: "terraform.tfvars.example",
      content: `aws_region   = "us-east-1"
project_name = "myapp"

# Replace with your VPC and subnets
vpc_id             = "vpc-xxxxxxxx"
private_subnet_ids = ["subnet-aaa", "subnet-bbb"]
public_subnet_ids  = ["subnet-pub1", "subnet-pub2"]

# Container images (ECR)
frontend_image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/frontend:latest"
api_image      = "123456789012.dkr.ecr.us-east-1.amazonaws.com/api:latest"
`,
    },
    {
      path: "variables.tf",
      content: `variable "aws_region" { type = string }
variable "project_name" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "frontend_image" { type = string }
variable "api_image" { type = string }
`,
    },
    {
      path: "providers.tf",
      content: `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
`,
    },
    {
      path: "alb.tf",
      content: `resource "aws_lb" "app" {
  name               = "\${var.project_name}-alb"
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_security_group" "alb" {
  name_prefix = "\${var.project_name}-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb_target_group" "fe" {
  name_prefix = "fe-"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  health_check {
    path = "/"
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb_target_group" "api" {
  name_prefix = "api-"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  health_check {
    path = "/health"
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fe.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
`,
    },
    {
      path: "ecs.tf",
      content: `resource "aws_ecs_cluster" "main" {
  name = "\${var.project_name}-cluster"
}

resource "aws_security_group" "svc" {
  name_prefix = "\${var.project_name}-svc-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_task_definition" "fe" {
  family                   = "\${var.project_name}-fe"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_exec.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "frontend"
    image = var.frontend_image
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
  }])
}

resource "aws_ecs_task_definition" "api" {
  family                   = "\${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_exec.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "api"
    image = var.api_image
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    environment = [
      { name = "DATABASE_URL", value = "postgresql://user:pass@\${aws_db_instance.main.address}:5432/app" }
    ]
  }])
}

resource "aws_ecs_service" "fe" {
  name            = "\${var.project_name}-fe"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.fe.arn
  desired_count   = ${feCount}
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.svc.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.fe.arn
    container_name   = "frontend"
    container_port   = 3000
  }
}

resource "aws_ecs_service" "api" {
  name            = "\${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = ${apiCount}
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.svc.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }
}
`,
    },
    {
      path: "iam_ecs.tf",
      content: `resource "aws_iam_role" "ecs_exec" {
  name = "\${var.project_name}-ecs-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_exec" {
  role       = aws_iam_role.ecs_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "\${var.project_name}-ecs-task"
  assume_role_policy = aws_iam_role.ecs_exec.assume_role_policy
}
`,
    },
    {
      path: "rds.tf",
      content: `resource "aws_db_subnet_group" "main" {
  name       = "\${var.project_name}-db-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "db" {
  name_prefix = "\${var.project_name}-db-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.svc.id]
  }
}

resource "aws_db_instance" "main" {
  identifier              = "\${var.project_name}-pg"
  engine                  = "postgres"
  instance_class          = "${dbClass}"
  allocated_storage       = 20
  username                = "app"
  password                = "CHANGE_ME_USE_SECRETS_MANAGER"
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  skip_final_snapshot     = true
  publicly_accessible     = false
  multi_az                = ${multiAz}
}
`,
    },
    {
      path: "outputs.tf",
      content: `output "alb_dns" {
  value = aws_lb.app.dns_name
}
`,
    },
  ];
}
