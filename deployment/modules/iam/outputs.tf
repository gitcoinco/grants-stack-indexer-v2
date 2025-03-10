output "processing_service_role_arn" {
  value = aws_iam_role.processing_service_role.arn
}

output "api_service_role_arn" {
  value = aws_iam_role.api_service_role.arn
}

output "bastion_instance_profile_name" {
  value = aws_iam_instance_profile.bastion_instance_profile.name
}
