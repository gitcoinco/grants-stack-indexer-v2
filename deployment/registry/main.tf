provider "aws" {
  region = var.AWS_REGION
  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      AppName     = "Indexer"
    }
  }
}

module "container_registry" {
  source   = "../modules/container-registry"
  app_name = var.APP_NAME
}

