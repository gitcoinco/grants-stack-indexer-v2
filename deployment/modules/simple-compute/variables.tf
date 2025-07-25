variable "app_name" {
  description = "Name of the application"
  type        = string
}

variable "app_environment" {
  description = "Environment (staging, production)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL for container images"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
  default     = ""
}

variable "public_subnets" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "api_security_group_id" {
  description = "Security group ID for API service"
  type        = string
}

variable "processing_security_group_id" {
  description = "Security group ID for processing services"
  type        = string
}

variable "api_target_group_arn" {
  description = "Target group ARN for API load balancer"
  type        = string
}

variable "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "CHAINS" {
  description = "List of blockchain chains to process"
  type = list(object({
    id       = number
    name     = string
    env_vars = list(object({
      name  = string
      value = string
    }))
  }))
  default = []
}
