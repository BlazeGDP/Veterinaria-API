output "canary_cluster_name" {
  value       = aws_ecs_cluster.canary.name
  description = "Clúster ECS independiente de V3.1 Canary."
}

output "canary_service_name" {
  value       = aws_ecs_service.canary.name
  description = "Servicio ECS de V3.1 Canary."
}

output "canary_task_definition_arn" {
  value       = aws_ecs_task_definition.canary.arn
  description = "Task Definition inmutable de V3.1."
}

output "canary_target_group_arn" {
  value       = aws_lb_target_group.canary.arn
  description = "Target Group dedicado a V3.1."
}

output "canary_image_tag" {
  value       = var.image_tag
  description = "Tag inmutable desplegado en Canary."
}

output "canary_url" {
  value       = "http://${data.terraform_remote_state.stable.outputs.alb_dns_name}"
  description = "URL compartida de entrada a Stable y Canary."
}
