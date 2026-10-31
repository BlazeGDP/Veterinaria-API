output "aws_region" {
  description = "Región AWS utilizada."
  value       = var.aws_region
}

output "vpc_id" {
  description = "ID de la VPC."
  value       = aws_vpc.main.id
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR."
  value       = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  description = "Endpoint privado de PostgreSQL."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Puerto de PostgreSQL."
  value       = aws_db_instance.postgres.port
}

output "db_secret_arn" {
  description = "ARN del secreto de credenciales de PostgreSQL."
  value       = aws_secretsmanager_secret.db.arn
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.api.name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS."
  value       = aws_ecs_service.api.name
}

output "ecs_task_definition_arn" {
  description = "ARN de la definición de tarea ECS."
  value       = aws_ecs_task_definition.api.arn
}

output "ecs_security_group_id" {
  description = "Security Group de las tareas ECS."
  value       = aws_security_group.ecs.id
}

output "private_subnet_ids" {
  description = "Subnets privadas usadas por ECS/RDS."
  value       = aws_subnet.private[*].id
}

output "alb_dns_name" {
  description = "DNS público del Application Load Balancer."
  value       = aws_lb.api.dns_name
}

output "api_url" {
  description = "URL pública de la API."
  value       = "http://${aws_lb.api.dns_name}"
}

output "stable_target_group_arn" {
  description = "Target Group de la API estable V3.0."
  value       = aws_lb_target_group.api.arn
}

output "alb_listener_arn" {
  description = "Listener HTTP compartido por los tracks."
  value       = aws_lb_listener.http.arn
}

output "alb_arn" {
  description = "ARN del ALB compartido."
  value       = aws_lb.api.arn
}

output "ecs_task_execution_role_arn" {
  description = "Rol de ejecución compartido por las tareas ECS."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "metrics_secret_arn" {
  description = "Secreto Bearer de autenticación para los endpoints Prometheus."
  value       = aws_secretsmanager_secret.metrics.arn
}

output "api_version" {
  description = "Versión semántica del track estable."
  value       = var.api_version
}

output "db_name" {
  description = "Nombre de la base de datos PostgreSQL compartida."
  value       = var.db_name
}

output "metrics_bearer_token" {
  description = "Token Bearer para scrape Prometheus y acceso de humo a Canary."
  value       = random_password.metrics.result
  sensitive   = true
}

output "stable_image_tag" {
  description = "Tag inmutable desplegado en Stable."
  value       = var.image_tag
}
