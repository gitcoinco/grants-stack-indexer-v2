# Deployment Infrastructure Documentation

## Overview

The deployment directory contains a complete blue-green deployment infrastructure managed through Terraform. For detailed deployment operations and workflow configurations, please refer to .github/README.md.

## Directory Structure

The deployment infrastructure is organized into three main directories:

1. environments/

    - Contains environment-specific configurations
    - Currently includes production environment
    - Manages deployment state and active environment variables
    - Coordinates all infrastructure modules

2. modules/

    - networking: VPC, subnets, and security groups
    - compute: ECS services for blue and green environments
    - storage: RDS database configuration
    - load_balancer: Application Load Balancer for traffic management
    - api-gw: API Gateway configuration
    - iam: IAM roles and policies
    - bastion: Bastion host setup

3. state/
    - Manages Terraform state configuration
    - Configures S3 backend for state storage

## Key Features

-   Blue-Green Deployment Management

    -   Two deployment states: "single" or "deploying"
    -   Active environment tracking (blue/green)
    -   Automated traffic switching through ALB

-   Database Management

    -   Separate blue and green databases
    -   Automated database creation
    -   Cache data synchronization between environments
    -   Managed through scripts in scripts/migrations/

-   Infrastructure Components

    -   Load balancer with health checks
    -   ECS tasks for API and processing services
    -   RDS PostgreSQL database
    -   VPC networking with public/private subnets

-   Configuration Management
    -   Environment-specific variables
    -   Sensitive data handling
    -   Service-specific configurations for both blue and green environments

For deployment operations and workflow details, please refer to the GitHub Actions workflow documentation in .github/README.md
