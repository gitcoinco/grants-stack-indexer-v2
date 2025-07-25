output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.simple_load_balancer.load_balancer_dns_name
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = module.simple_compute.cluster_name
}

output "image_tag" {
  description = "Currently deployed image tag"
  value       = var.IMAGE_TAG
}

output "api_gateway_url" {
  value = module.api_gateway.api_gateway_url
}
