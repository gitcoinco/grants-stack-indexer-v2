variable "app_name" {
  description = "The name of the application"
  type        = string
}

variable "app_environment" {
  description = "The environment (staging, production, etc.)"
  type        = string
}

variable "lb_dns_name" {
  description = "The DNS name of the Load Balancer"
  type        = string
}

variable "throttle_rate_limit" {
  description = "API Gateway rate limit per second"
  type        = number
  default     = 50
}

variable "throttle_burst_limit" {
  description = "API Gateway burst limit"
  type        = number
  default     = 100
}

variable "quota_limit" {
  description = "API Gateway daily quota limit"
  type        = number
  default     = 10000
}
