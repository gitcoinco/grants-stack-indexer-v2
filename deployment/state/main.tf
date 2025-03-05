provider "aws" {
  region = var.AWS_REGION
}
data "aws_caller_identity" "current" {}

locals {
  bucket_name = "${var.APP_NAME}-terraform-state"
  account_id  = data.aws_caller_identity.current.account_id
}

module "s3_terraform_state" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "4.4.0"

  bucket = local.bucket_name

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  # Enable versioning
  versioning = {
    enabled = true
  }

  # Enable object lock
  object_lock_configuration = {
    object_lock_enabled = "Enabled"
  }

  # Enable server-side encryption
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "AWS" : "arn:aws:iam::${local.account_id}:root"
        },
        "Action" : [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        "Resource" : [
          "arn:aws:s3:::${local.bucket_name}",
          "arn:aws:s3:::${local.bucket_name}/*"
        ]
      }
    ]
  })

  tags = {
    Name = local.bucket_name
  }
}
