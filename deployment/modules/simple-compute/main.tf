locals {
  log_group_name     = "/ecs/${var.app_name}-${var.app_environment}"
  api_container_name = "${var.app_name}-${var.app_environment}-api"
}

module "ecs" {
  source  = "terraform-aws-modules/ecs/aws"
  version = "5.12.0"
  
  ####################################
  # ECS Cluster
  ####################################
  cluster_name = "${var.app_name}-${var.app_environment}-cluster"

  ####################################
  # Log Group
  ####################################
  cloudwatch_log_group_name              = local.log_group_name
  cloudwatch_log_group_retention_in_days = 7

  ####################################
  # Services
  ####################################
  services = merge(
    {
      api_service = {
        name                   = "${var.app_name}-api-service"
        create_security_group  = false
        create_task_definition = false
        task_definition_arn    = aws_ecs_task_definition.api_task.arn
        desired_count          = 1
        platform_version       = "LATEST"
        force_new_deployment   = true
        assign_public_ip       = true
        subnet_ids             = var.public_subnets
        security_group_ids     = [var.api_security_group_id]

        autoscaling = {
          min_capacity = 1
          max_capacity = 3
          cpu = {
            target_value       = 75
            scale_in_cooldown  = 300
            scale_out_cooldown = 300
          }
        }

        load_balancer = {
          service = {
            target_group_arn = var.api_target_group_arn
            container_name   = local.api_container_name
            container_port   = 3000
          }
        }
      }
    },
    # Processing tasks for each chain
    {
      for chain in var.CHAINS : "processing_${chain.id}" => {
        name                   = "processing-${chain.id}"
        create_security_group  = false
        create_task_definition = false
        task_definition_arn    = aws_ecs_task_definition.processing_tasks[chain.id].arn
        desired_count          = 1
        platform_version       = "LATEST"
        force_new_deployment   = true
        assign_public_ip       = true
        subnet_ids             = var.public_subnets
        security_group_ids     = [var.processing_security_group_id]

        autoscaling = {
          min_capacity = 1
          max_capacity = 2
          cpu = {
            target_value       = 75
            scale_in_cooldown  = 300
            scale_out_cooldown = 300
          }
        }
      }
    }
  )

  tags = {
    Environment = var.app_environment
    Project     = var.app_name
  }
}

####################################
# API Task Definition
####################################
resource "aws_ecs_task_definition" "api_task" {
  family                   = "${var.app_name}-${var.app_environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.api_container_name
      image     = "${var.ecr_repository_url}:${var.image_tag}"
      essential = true
      
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.app_environment
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "DATABASE_URL"
          value = var.database_url
        },
        {
          name  = "REDIS_URL"
          value = var.redis_url
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Environment = var.app_environment
    Project     = var.app_name
  }
}

####################################
# Processing Task Definitions
####################################
resource "aws_ecs_task_definition" "processing_tasks" {
  for_each                 = { for chain in var.CHAINS : chain.id => chain }
  family                   = "processing-${each.value.id}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "processing-${each.value.id}"
      image     = "${var.ecr_repository_url}:${var.image_tag}"
      essential = true
      
      command = ["npm", "run", "process", "--", "--chain", each.value.id]

      environment = concat([
        {
          name  = "NODE_ENV"
          value = var.app_environment
        },
        {
          name  = "DATABASE_URL"
          value = var.database_url
        },
        {
          name  = "REDIS_URL"
          value = var.redis_url
        },
        {
          name  = "CHAIN_ID"
          value = tostring(each.value.id)
        }
      ], each.value.env_vars)

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.log_group_name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "processing-${each.value.id}"
        }
      }
    }
  ])

  tags = {
    Environment = var.app_environment
    Project     = var.app_name
    Chain       = each.value.id
  }
}
