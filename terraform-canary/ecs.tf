resource "aws_ecs_cluster" "canary" {
  name = "${var.project_name}-canary-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "canary" {
  name              = "/ecs/${var.project_name}/canary"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "canary" {
  family                   = "${var.project_name}-canary-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = data.terraform_remote_state.stable.outputs.ecs_task_execution_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${data.terraform_remote_state.stable.outputs.ecr_repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "APP_VERSION", value = var.api_version },
        { name = "APP_TRACK", value = "canary" },
        { name = "CANARY_FEATURE_ENABLED", value = "true" },
        { name = "CANARY_FAILURE_ENABLED", value = "true" },
        { name = "CANARY_FAILURE_LATENCY_MS", value = "1500" },
        { name = "APP_CPU_CORES", value = tostring(var.ecs_cpu / 1024) },
        { name = "APP_MEMORY_LIMIT_MB", value = tostring(var.ecs_memory) },
        { name = "DATABASE_HOST", value = data.terraform_remote_state.stable.outputs.rds_endpoint },
        { name = "DATABASE_PORT", value = "5432" },
        { name = "DATABASE_NAME", value = data.terraform_remote_state.stable.outputs.db_name },
        { name = "DATABASE_SSL", value = "true" }
      ]

      secrets = [
        {
          name      = "DATABASE_USER"
          valueFrom = "${data.terraform_remote_state.stable.outputs.db_secret_arn}:username::"
        },
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = "${data.terraform_remote_state.stable.outputs.db_secret_arn}:password::"
        },
        {
          name      = "METRICS_BEARER_TOKEN"
          valueFrom = data.terraform_remote_state.stable.outputs.metrics_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.canary.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-canary-task"
  }
}

resource "aws_ecs_service" "canary" {
  name                               = "${var.project_name}-canary-service"
  cluster                            = aws_ecs_cluster.canary.id
  task_definition                    = aws_ecs_task_definition.canary.arn
  desired_count                      = var.ecs_desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = data.terraform_remote_state.stable.outputs.private_subnet_ids
    security_groups  = [data.terraform_remote_state.stable.outputs.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.canary.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  depends_on = [
    aws_lb_listener_rule.canary_smoke,
    aws_lb_listener_rule.canary_metrics,
  ]

  tags = {
    Name  = "${var.project_name}-canary-service"
    Track = "canary"
  }
}
