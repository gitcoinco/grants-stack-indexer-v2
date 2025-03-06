# Processing service role
resource "aws_iam_role" "processing_service_role" {
  name = "${var.app_name}-${var.app_environment}-ProcessingServiceRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# API service role
resource "aws_iam_role" "api_service_role" {
  name = "${var.app_name}-${var.app_environment}-ApiServiceRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role" "bastion_role" {
  name = "${var.app_name}-${var.app_environment}-BastionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}



resource "aws_iam_instance_profile" "bastion_instance_profile" {
  name = "${var.app_name}-${var.app_environment}-bastion-profile"
  role = aws_iam_role.bastion_role.name
}

# RDS access policy
resource "aws_iam_policy" "rds_access_policy" {
  name = "${var.app_name}-${var.app_environment}-RDSAccessPolicy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "rds:DescribeDBInstances",
          "rds:Connect"
        ],
        Resource = "arn:aws:rds:${var.region}:${var.account_id}:db:*"
      }
    ]
  })
}

resource "aws_iam_policy" "secrets_access_policy" {
  name = "${var.app_name}-${var.app_environment}-SecretsAccessPolicy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue"
        ],
        Resource = "arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:${var.app_name}-${var.app_environment}-secrets"
      }
    ]
  })
}

# ECR access policy
resource "aws_iam_policy" "ecr_access_policy" {
  name = "${var.app_name}-${var.app_environment}-ECRAccessPolicy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ],
        Resource = "*"
      }
    ]
  })
}

# Logger access policy
resource "aws_iam_policy" "logger_access_policy" {
  name = "${var.app_name}-${var.app_environment}-LoggerAccessPolicy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

# SSM policy
resource "aws_iam_role_policy_attachment" "ssm_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.bastion_role.name
}

# Attach the RDS access policy to the processing service role
resource "aws_iam_role_policy_attachment" "attach_rds_access_processing" {
  policy_arn = aws_iam_policy.rds_access_policy.arn
  role       = aws_iam_role.processing_service_role.name
}

# Attach the Secrets access policy to the processing service role
resource "aws_iam_role_policy_attachment" "attach_secrets_access_processing" {
  policy_arn = aws_iam_policy.secrets_access_policy.arn
  role       = aws_iam_role.processing_service_role.name
}

# Attach the Secrets access policy to the API service role
resource "aws_iam_role_policy_attachment" "attach_secrets_access_api" {
  policy_arn = aws_iam_policy.secrets_access_policy.arn
  role       = aws_iam_role.api_service_role.name
}

# Attach the ECR access policy to the processing service role
resource "aws_iam_role_policy_attachment" "attach_ecr_access_processing" {
  policy_arn = aws_iam_policy.ecr_access_policy.arn
  role       = aws_iam_role.processing_service_role.name
}

# Attach the RDS access policy to the API service role
resource "aws_iam_role_policy_attachment" "attach_rds_access_api" {
  policy_arn = aws_iam_policy.rds_access_policy.arn
  role       = aws_iam_role.api_service_role.name
}

# Attach the ECR access policy to the API service role
resource "aws_iam_role_policy_attachment" "attach_ecr_access_api" {
  policy_arn = aws_iam_policy.ecr_access_policy.arn
  role       = aws_iam_role.api_service_role.name
}

# Attach the Logger access policy to the processing service role
resource "aws_iam_role_policy_attachment" "attach_logger_access_processing" {
  policy_arn = aws_iam_policy.logger_access_policy.arn
  role       = aws_iam_role.processing_service_role.name
}

# Attach the Logger access policy to the API service role
resource "aws_iam_role_policy_attachment" "attach_logger_access_api" {
  policy_arn = aws_iam_policy.logger_access_policy.arn
  role       = aws_iam_role.api_service_role.name
}
