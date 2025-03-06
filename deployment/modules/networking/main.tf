###############################################################################
# VPC Module
###############################################################################
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.17.0"

  # The name that will be applied to all VPC resources
  name = "${var.app_name}-${var.app_environment}-vpc"

  # Our main VPC CIDR block
  cidr = "10.0.0.0/16"

  azs                     = ["us-east-2a", "us-east-2b"]
  map_public_ip_on_launch = true
  public_subnets          = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets         = ["10.0.3.0/24", "10.0.4.0/24"]
  # We need a NAT Gateway to route from private subnets out to the internet
  enable_nat_gateway = true
  # We'll only have a single NAT Gateway instead of 1 per AZ
  single_nat_gateway = true

  # Optional: Tag everything
  tags = {
    Name        = "${var.app_name}-${var.app_environment}-vpc"
    Environment = var.app_environment
  }
}

###############################################################################
# Security Group
###############################################################################
resource "aws_security_group" "processing" {
  name   = "${var.app_name}-${var.app_environment}-processing-sg"
  vpc_id = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-processing-sg"
    Environment = var.app_environment
  }

}



resource "aws_security_group" "rds" {

  name   = "${var.app_name}-${var.app_environment}-rds-sg"
  vpc_id = module.vpc.vpc_id

  # Allow access from private subnets (for processing service)
  ingress {
    from_port   = 5432 # Default PostgreSQL port
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = module.vpc.private_subnets_cidr_blocks # Allow access from private subnets
  }

  # Allow access from public subnets (for API)
  ingress {
    from_port   = 5432 # Default PostgreSQL port
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = module.vpc.public_subnets_cidr_blocks # Allow access from public subnets
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-rds-sg"
    Environment = var.app_environment
  }
}

resource "aws_security_group" "load_balancer" {
  name   = "${var.app_name}-${var.app_environment}-load-balancer-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-load-balancer-sg"
    Environment = var.app_environment
  }

}

resource "aws_security_group" "api" {
  name   = "${var.app_name}-${var.app_environment}-api-sg"
  vpc_id = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-api-sg"
    Environment = var.app_environment
  }
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "${var.app_name}-${var.app_environment}-rds-subnet-group"
  subnet_ids = module.vpc.private_subnets


  tags = {
    Name = "${var.app_name}-${var.app_environment}-rds-subnet-group"
  }
}
