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
  description = "Endpoint de PostgreSQL."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "Puerto de PostgreSQL."
  value       = aws_db_instance.postgres.port
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.api.name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS."
  value       = aws_ecs_service.api.name
}

output "alb_dns_name" {
  description = "DNS público del Application Load Balancer."
  value       = aws_lb.api.dns_name
}

output "api_url" {
  description = "URL base de la API."
  value       = "http://${aws_lb.api.dns_name}"
}