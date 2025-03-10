# Create ECR repository
resource "aws_ecr_repository" "processing_repository" {
  name = "${var.app_name}-processing"
}
