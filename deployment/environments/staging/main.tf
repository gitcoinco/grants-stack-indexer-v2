terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.84.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = "us-east-2"
}


data "aws_caller_identity" "current" {}


module "networking" {
  source          = "../../modules/networking"
  app_environment = var.APP_ENVIRONMENT
  app_name        = var.APP_NAME
  region          = var.AWS_REGION
}

module "iam" {
  source          = "../../modules/iam"
  app_name        = var.APP_NAME
  app_environment = var.APP_ENVIRONMENT
  region          = var.AWS_REGION
  account_id      = data.aws_caller_identity.current.account_id
}

module "storage" {
  source                = "../../modules/storage"
  app_name              = var.APP_NAME
  app_environment       = var.APP_ENVIRONMENT
  region                = var.AWS_REGION
  rds_username          = var.DATALAYER_PG_USER
  rds_password          = var.DATALAYER_PG_PASSWORD
  rds_instance_class    = "db.t4g.medium"
  rds_security_group_id = module.networking.rds_security_group_id
  rds_subnet_ids        = module.networking.private_subnets
  rds_subnet_group_name = module.networking.rds_subnet_group_name
}

module "bastion" {
  source                        = "../../modules/bastion"
  app_environment               = var.APP_ENVIRONMENT
  app_name                      = var.APP_NAME
  subnet_id                     = module.networking.private_subnets[0]
  bastion_instance_profile_name = module.iam.bastion_instance_profile_name
  bastion_security_group_id     = module.networking.processing_security_group_id
  instance_type                 = "t3.large"
}

module "load_balancer" {
  source                          = "../../modules/load_balancer"
  app_name                        = var.APP_NAME
  app_environment                 = var.APP_ENVIRONMENT
  vpc_id                          = module.networking.vpc_id
  public_subnets                  = module.networking.public_subnets
  load_balancer_security_group_id = module.networking.load_balancer_security_group_id
  active_deployment               = var.ACTIVE_DEPLOYMENT
}

module "api_gateway" {
  source          = "../../modules/api-gw"
  app_name        = var.APP_NAME
  app_environment = var.APP_ENVIRONMENT
  lb_dns_name     = module.load_balancer.lb_dns_name
}


module "blue_compute" {
  color                                          = "blue"
  should_deploy_module                           = var.ACTIVE_DEPLOYMENT == "blue" || var.DEPLOYMENT_STATE == "deploying"
  is_active_deployment                           = var.ACTIVE_DEPLOYMENT == "blue"
  source                                         = "../../modules/compute"
  app_name                                       = var.APP_NAME
  app_environment                                = var.APP_ENVIRONMENT
  region                                         = var.AWS_REGION
  processing_repository_url                      = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.AWS_REGION}.amazonaws.com/${var.APP_NAME}-processing"
  processing_service_role_arn                    = module.iam.processing_service_role_arn
  processing_image_tag                           = var.BLUE_PROCESSING_IMAGE_TAG
  processing_security_group_id                   = module.networking.processing_security_group_id
  api_image_tag                                  = var.BLUE_API_IMAGE_TAG
  api_repository_url                             = var.BLUE_API_REPOSITORY_URL
  api_service_role_arn                           = module.iam.api_service_role_arn
  api_security_group_id                          = module.networking.api_security_group_id
  api_security_group_id_without_lb               = module.networking.api_security_group_id_without_lb
  lb_target_group_arn                            = module.load_balancer.lb_blue_target_group_arn
  NODE_ENV                                       = var.BLUE_NODE_ENV
  RETRY_BASE_DELAY_MS                            = var.BLUE_RETRY_BASE_DELAY_MS
  RETRY_MAX_DELAY_MS                             = var.BLUE_RETRY_MAX_DELAY_MS
  RETRY_FACTOR                                   = var.BLUE_RETRY_FACTOR
  RETRY_MAX_ATTEMPTS                             = var.BLUE_RETRY_MAX_ATTEMPTS
  DATALAYER_HASURA_DATABASE_URL                  = "postgresql://${var.DATALAYER_PG_USER}:${var.DATALAYER_PG_PASSWORD}@${module.storage.rds_endpoint}/${var.BLUE_DATALAYER_PG_DB_NAME}"
  DATALAYER_HASURA_EXPOSED_PORT                  = var.BLUE_DATALAYER_HASURA_EXPOSED_PORT
  DATALAYER_HASURA_ENABLE_CONSOLE                = var.BLUE_DATALAYER_HASURA_ENABLE_CONSOLE
  DATALAYER_HASURA_ADMIN_SECRET                  = var.BLUE_DATALAYER_HASURA_ADMIN_SECRET
  DATALAYER_HASURA_UNAUTHORIZED_ROLE             = var.BLUE_DATALAYER_HASURA_UNAUTHORIZED_ROLE
  DATALAYER_HASURA_CORS_DOMAIN                   = var.BLUE_DATALAYER_HASURA_CORS_DOMAIN
  DATALAYER_HASURA_ENABLE_TELEMETRY              = var.BLUE_DATALAYER_HASURA_ENABLE_TELEMETRY
  DATALAYER_HASURA_DEV_MODE                      = var.BLUE_DATALAYER_HASURA_DEV_MODE
  DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS         = var.BLUE_DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS
  DATALAYER_HASURA_CONSOLE_ASSETS_DIR            = var.BLUE_DATALAYER_HASURA_CONSOLE_ASSETS_DIR
  DATALAYER_HASURA_ENABLED_LOG_TYPES             = var.BLUE_DATALAYER_HASURA_ENABLED_LOG_TYPES
  DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION     = var.BLUE_DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION
  DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT = var.BLUE_DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT
  DATALAYER_HASURA_EXPERIMENTAL_FEATURES         = var.BLUE_DATALAYER_HASURA_EXPERIMENTAL_FEATURES
  DATALAYER_HASURA_ENABLE_ALLOW_LIST             = var.BLUE_DATALAYER_HASURA_ENABLE_ALLOW_LIST
  CHAINS                                         = var.BLUE_CHAINS

  DATABASE_URL        = "postgresql://${var.DATALAYER_PG_USER}:${var.DATALAYER_PG_PASSWORD}@${module.storage.rds_endpoint}/${var.BLUE_DATALAYER_PG_DB_NAME}"
  INDEXER_GRAPHQL_URL = var.BLUE_INDEXER_GRAPHQL_URL
  # INDEXER_ADMIN_SECRET                           = var.INDEXER_ADMIN_SECRET
  PUBLIC_GATEWAY_URLS = var.BLUE_PUBLIC_GATEWAY_URLS
  METADATA_SOURCE     = var.BLUE_METADATA_SOURCE
  PRICING_SOURCE      = var.BLUE_PRICING_SOURCE
  COINGECKO_API_KEY   = var.BLUE_COINGECKO_API_KEY
  COINGECKO_API_TYPE  = var.BLUE_COINGECKO_API_TYPE
  LOG_LEVEL           = var.BLUE_LOG_LEVEL
  public_subnets      = module.networking.public_subnets
  private_subnets     = module.networking.private_subnets
}


module "green_compute" {
  color                                          = "green"
  source                                         = "../../modules/compute"
  should_deploy_module                           = var.ACTIVE_DEPLOYMENT == "green" || var.DEPLOYMENT_STATE == "deploying"
  is_active_deployment                           = var.ACTIVE_DEPLOYMENT == "green"
  app_name                                       = var.APP_NAME
  app_environment                                = var.APP_ENVIRONMENT
  region                                         = var.AWS_REGION
  processing_repository_url                      = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.AWS_REGION}.amazonaws.com/${var.APP_NAME}-processing"
  processing_service_role_arn                    = module.iam.processing_service_role_arn
  processing_image_tag                           = var.GREEN_PROCESSING_IMAGE_TAG
  processing_security_group_id                   = module.networking.processing_security_group_id
  api_image_tag                                  = var.GREEN_API_IMAGE_TAG
  api_repository_url                             = var.GREEN_API_REPOSITORY_URL
  api_service_role_arn                           = module.iam.api_service_role_arn
  api_security_group_id                          = module.networking.api_security_group_id
  api_security_group_id_without_lb               = module.networking.api_security_group_id_without_lb
  lb_target_group_arn                            = module.load_balancer.lb_green_target_group_arn
  NODE_ENV                                       = var.GREEN_NODE_ENV
  RETRY_BASE_DELAY_MS                            = var.GREEN_RETRY_BASE_DELAY_MS
  RETRY_MAX_DELAY_MS                             = var.GREEN_RETRY_MAX_DELAY_MS
  RETRY_FACTOR                                   = var.GREEN_RETRY_FACTOR
  RETRY_MAX_ATTEMPTS                             = var.GREEN_RETRY_MAX_ATTEMPTS
  DATALAYER_HASURA_DATABASE_URL                  = "postgresql://${var.DATALAYER_PG_USER}:${var.DATALAYER_PG_PASSWORD}@${module.storage.rds_endpoint}/${var.GREEN_DATALAYER_PG_DB_NAME}"
  DATALAYER_HASURA_EXPOSED_PORT                  = var.GREEN_DATALAYER_HASURA_EXPOSED_PORT
  DATALAYER_HASURA_ENABLE_CONSOLE                = var.GREEN_DATALAYER_HASURA_ENABLE_CONSOLE
  DATALAYER_HASURA_ADMIN_SECRET                  = var.GREEN_DATALAYER_HASURA_ADMIN_SECRET
  DATALAYER_HASURA_UNAUTHORIZED_ROLE             = var.GREEN_DATALAYER_HASURA_UNAUTHORIZED_ROLE
  DATALAYER_HASURA_CORS_DOMAIN                   = var.GREEN_DATALAYER_HASURA_CORS_DOMAIN
  DATALAYER_HASURA_ENABLE_TELEMETRY              = var.GREEN_DATALAYER_HASURA_ENABLE_TELEMETRY
  DATALAYER_HASURA_DEV_MODE                      = var.GREEN_DATALAYER_HASURA_DEV_MODE
  DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS         = var.GREEN_DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS
  DATALAYER_HASURA_CONSOLE_ASSETS_DIR            = var.GREEN_DATALAYER_HASURA_CONSOLE_ASSETS_DIR
  DATALAYER_HASURA_ENABLED_LOG_TYPES             = var.GREEN_DATALAYER_HASURA_ENABLED_LOG_TYPES
  DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION     = var.GREEN_DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION
  DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT = var.GREEN_DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT
  DATALAYER_HASURA_EXPERIMENTAL_FEATURES         = var.GREEN_DATALAYER_HASURA_EXPERIMENTAL_FEATURES
  DATALAYER_HASURA_ENABLE_ALLOW_LIST             = var.GREEN_DATALAYER_HASURA_ENABLE_ALLOW_LIST
  CHAINS                                         = var.GREEN_CHAINS

  DATABASE_URL        = "postgresql://${var.DATALAYER_PG_USER}:${var.DATALAYER_PG_PASSWORD}@${module.storage.rds_endpoint}/${var.GREEN_DATALAYER_PG_DB_NAME}"
  INDEXER_GRAPHQL_URL = var.GREEN_INDEXER_GRAPHQL_URL
  PUBLIC_GATEWAY_URLS = var.GREEN_PUBLIC_GATEWAY_URLS
  METADATA_SOURCE     = var.GREEN_METADATA_SOURCE
  PRICING_SOURCE      = var.GREEN_PRICING_SOURCE
  COINGECKO_API_KEY   = var.GREEN_COINGECKO_API_KEY
  COINGECKO_API_TYPE  = var.GREEN_COINGECKO_API_TYPE
  LOG_LEVEL           = var.GREEN_LOG_LEVEL
  public_subnets      = module.networking.public_subnets
  private_subnets     = module.networking.private_subnets
}

