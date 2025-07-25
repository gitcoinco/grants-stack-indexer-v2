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
  rds_security_group_id = module.networking.rds_security_group_id
  rds_subnet_ids        = module.networking.private_subnets
  rds_subnet_group_name = module.networking.rds_subnet_group_name
  rds_instance_class    = "db.t4g.micro"
}

module "bastion" {
  source                        = "../../modules/bastion"
  app_environment               = var.APP_ENVIRONMENT
  app_name                      = var.APP_NAME
  instance_type                 = "t3.large"
  subnet_id                     = module.networking.private_subnets[0]
  bastion_instance_profile_name = module.iam.bastion_instance_profile_name
  bastion_security_group_id     = module.networking.processing_security_group_id
}

module "simple_load_balancer" {
  source                = "../../modules/simple-load-balancer"
  app_name              = var.APP_NAME
  app_environment       = var.APP_ENVIRONMENT
  vpc_id                = module.networking.vpc_id
  public_subnets        = module.networking.public_subnets
  alb_security_group_id = module.networking.alb_security_group_id
  ssl_certificate_arn   = var.SSL_CERTIFICATE_ARN
}

module "simple_compute" {
  source                        = "../../modules/simple-compute"
  app_name                      = var.APP_NAME
  app_environment               = var.APP_ENVIRONMENT
  region                        = var.AWS_REGION
  ecr_repository_url            = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.AWS_REGION}.amazonaws.com/${var.APP_NAME}"
  image_tag                     = var.IMAGE_TAG
  database_url                  = "postgresql://${var.DATALAYER_PG_USER}:${var.DATALAYER_PG_PASSWORD}@${module.storage.rds_endpoint}/${var.DATALAYER_PG_DB_NAME}"
  redis_url                     = var.REDIS_URL
  public_subnets                = module.networking.public_subnets
  api_security_group_id         = module.networking.api_security_group_id
  processing_security_group_id  = module.networking.processing_security_group_id
  api_target_group_arn          = module.simple_load_balancer.api_target_group_arn
  ecs_task_execution_role_arn   = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn             = module.iam.ecs_task_role_arn
  CHAINS                        = var.CHAINS
}

module "api_gateway" {
  source          = "../../modules/api-gw"
  app_name        = var.APP_NAME
  app_environment = var.APP_ENVIRONMENT
  lb_dns_name     = module.simple_load_balancer.load_balancer_dns_name
}
