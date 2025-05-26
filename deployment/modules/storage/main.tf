module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.10.0"

  identifier = "${var.app_name}-${var.app_environment}-rds"

  db_subnet_group_name = var.rds_subnet_group_name
  family               = "postgres16"
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.rds_instance_class
  allocated_storage    = 10

  manage_master_user_password = false
  username                    = var.rds_username
  password                    = var.rds_password

  vpc_security_group_ids = [var.rds_security_group_id]
  subnet_ids             = var.rds_subnet_ids

  backup_retention_period = 7
  backup_window           = "03:00-06:00"

  maintenance_window = "Mon:00:00-Mon:03:00"

  publicly_accessible = true

  storage_encrypted = true

  tags = {
    Environment = var.app_environment
    Project     = var.app_name
  }
}
