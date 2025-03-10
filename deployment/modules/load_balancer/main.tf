resource "aws_lb" "load_balancer" {
  name               = "${var.app_name}-${var.app_environment}-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnets
  security_groups    = [var.load_balancer_security_group_id]
}

resource "aws_lb_target_group" "green_api_target_group" {
  name        = "${var.app_name}-${var.app_environment}-g"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    enabled             = true
    healthy_threshold   = 5
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  tags = {
    Name = "${var.app_name}-${var.app_environment}-green-api-tg"
  }
}
resource "aws_lb_target_group" "blue_api_target_group" {
  name        = "${var.app_name}-${var.app_environment}-b"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    enabled             = true
    healthy_threshold   = 5
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  tags = {
    Name = "${var.app_name}-${var.app_environment}-blue-api-tg"
  }
}

resource "aws_lb_listener" "api_listener" {
  load_balancer_arn = aws_lb.load_balancer.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = var.active_deployment == "green" ? aws_lb_target_group.green_api_target_group.arn : aws_lb_target_group.blue_api_target_group.arn
  }
}
