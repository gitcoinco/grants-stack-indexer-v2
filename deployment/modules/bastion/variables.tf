variable "app_name" {
  description = "The name of the application"
  type        = string
}

variable "app_environment" {
  description = "The environment of the application (e.g., dev, staging, prod)"
  type        = string
}

variable "subnet_id" {
  description = "The subnet ID where the bastion host will be deployed"
  type        = string
}

variable "bastion_instance_profile_name" {
  description = "The name of the bastion instance profile"
  type        = string
}

variable "bastion_security_group_id" {
  description = "The ID of the bastion security group"
  type        = string
}
