variable "app_name" {
  description = "Cluster name"
  type        = string
}

variable "app_environment" {
  description = "App environment"
  type        = string
}

variable "region" {
  description = "Region"
  type        = string
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "rds_username" {
  description = "RDS username"
  type        = string
}

variable "rds_password" {
  description = "RDS password"
  type        = string
}

variable "rds_security_group_id" {
  description = "RDS security group id"
  type        = string
}

variable "rds_subnet_ids" {
  description = "RDS subnet ids"
  type        = list(string)
}

variable "rds_subnet_group_name" {
  description = "RDS subnet group name"
  type        = string
}
