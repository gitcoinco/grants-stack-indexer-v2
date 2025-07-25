output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = module.ecs.cluster_arn
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "api_service_name" {
  description = "API service name"
  value       = module.ecs.services["api_service"].name
}

output "processing_service_names" {
  description = "Processing service names"
  value       = { for k, v in module.ecs.services : k => v.name if startswith(k, "processing_") }
}

output "api_task_definition_arn" {
  description = "API task definition ARN"
  value       = aws_ecs_task_definition.api_task.arn
}

output "processing_task_definition_arns" {
  description = "Processing task definition ARNs"
  value       = { for k, v in aws_ecs_task_definition.processing_tasks : k => v.arn }
}
