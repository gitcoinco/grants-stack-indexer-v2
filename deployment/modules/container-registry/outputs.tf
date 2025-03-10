output "processing_repository_url" {
  value = aws_ecr_repository.processing_repository.repository_url
}

output "processing_repository_arn" {
  value = aws_ecr_repository.processing_repository.arn
}
