output "lb_green_target_group_arn" {
  value = aws_lb_target_group.green_api_target_group.arn
}

output "lb_blue_target_group_arn" {
  value = aws_lb_target_group.blue_api_target_group.arn
}

output "lb_dns_name" {
  value = aws_lb.load_balancer.dns_name
}
