output "active_deployment" {
  value = var.ACTIVE_DEPLOYMENT
}

output "deployment_state" {
  value = var.DEPLOYMENT_STATE
}

output "api_gateway_url" {
  value = module.api_gateway.api_gateway_url
}

output "rds_endpoint" {
  value = module.storage.rds_endpoint
}