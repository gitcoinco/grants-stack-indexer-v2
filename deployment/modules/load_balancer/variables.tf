variable "app_name" {
  description = "Cluster name"
  type        = string
}

variable "app_environment" {
  description = "App environment"
  type        = string
}

variable "active_deployment" {
  description = "Active deployment"
  validation {
    condition     = contains(["green", "blue"], var.active_deployment)
    error_message = "Active environment must be either 'green' or 'blue'."
  }
  type = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnets" {
  description = "Public subnets"
  type        = list(string)
}

variable "load_balancer_security_group_id" {
  description = "Load balancer security group ID"
  type        = string
}

