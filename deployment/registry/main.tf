provider "aws" {
  region = var.AWS_REGION
}

module "container_registry" {
  source   = "../modules/container-registry"
  app_name = var.APP_NAME
}

