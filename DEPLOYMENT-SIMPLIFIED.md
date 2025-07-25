# Simplified Deployment Guide

This guide covers the new simplified deployment process that replaces the complex blue/green deployment with a single ECS service + RDS setup.

## Overview

The simplified deployment architecture consists of:
- **Single ECS Cluster** with API and processing services
- **Application Load Balancer** for traffic routing
- **RDS PostgreSQL Database** (shared, no blue/green complexity)
- **ECR Repository** for container images
- **S3 Buckets** for Terraform state and database backups

## Prerequisites

### Required Tools
- AWS CLI v2
- Terraform >= 1.6.0
- Docker
- Node.js (see `.nvmrc`)
- pnpm 9.7.1
- PostgreSQL client (for database operations)

### Required AWS Permissions
Your AWS credentials need permissions for:
- ECS (clusters, services, tasks)
- RDS (database management)
- ECR (container registry)
- S3 (state and backups)
- IAM (roles and policies)
- VPC (networking)
- Application Load Balancer

### Environment Variables

Set these environment variables for deployment:

```bash
# Required
export AWS_REGION="us-east-2"
export APP_NAME="grants-stack-indexer"
export DATALAYER_PG_USER="your-db-username"
export DATALAYER_PG_PASSWORD="your-db-password"

# Optional
export DATALAYER_PG_DB_NAME="grants_stack_indexer"  # default
export SSL_CERTIFICATE_ARN=""                       # for HTTPS
export REDIS_URL=""                                  # if using Redis
export CHAINS='[]'                                   # blockchain chains config
```

## Quick Start

### 1. Initial Setup

First, set up the basic AWS infrastructure:

```bash
# Setup infrastructure (ECR, S3 buckets)
./scripts/setup-infrastructure.sh -e staging
./scripts/setup-infrastructure.sh -e production
```

### 2. Deploy to Staging

```bash
# Deploy latest code to staging
./scripts/deploy-simple.sh -e staging
```

### 3. Deploy to Production

```bash
# Deploy specific version to production
./scripts/deploy-simple.sh -e production -t v1.2.3
```

## Deployment Methods

### Method 1: Manual Deployment (Scripts)

Use the provided shell scripts for manual deployments:

```bash
# Full deployment with tests and build
./scripts/deploy-simple.sh -e staging

# Deploy specific image tag
./scripts/deploy-simple.sh -e production -t v1.2.3

# Skip tests and build (deploy existing image)
./scripts/deploy-simple.sh -e staging --skip-tests --skip-build

# Auto-approve Terraform changes (use with caution)
./scripts/deploy-simple.sh -e production --auto-approve
```

### Method 2: GitHub Actions (CI/CD)

The repository includes automated CI/CD workflows:

#### Automatic Deployments
- **Push to `staging` branch** → Deploys to staging environment
- **Push to `main` branch** → Deploys to production environment

#### Manual Deployments
Use the GitHub Actions UI to trigger manual deployments:

1. Go to **Actions** tab in your GitHub repository
2. Find and click on **"Deploy to AWS (Simplified)"** workflow
3. Click **"Run workflow"** button
4. Select environment and image tag from the dropdown/input fields
5. Click **"Run workflow"** to start the deployment

### Method 3: Direct Terraform

For advanced users who want direct control:

```bash
cd deployment/environments/staging

# Initialize
terraform init \
  -backend-config="bucket=grants-stack-indexer-staging-terraform-state" \
  -backend-config="key=grants-stack-indexer/staging/terraform.tfstate" \
  -backend-config="region=us-east-2"

# Plan and apply
export TF_VAR_IMAGE_TAG="latest"
terraform plan
terraform apply
```

## Infrastructure Components

### Terraform Modules

The simplified deployment uses these Terraform modules:

- **`simple-compute`**: ECS cluster with API and processing services
- **`simple-load-balancer`**: Application Load Balancer with single target group
- **`networking`**: VPC, subnets, security groups (reused from original)
- **`storage`**: RDS PostgreSQL database (reused from original)
- **`iam`**: IAM roles and policies (reused from original)

### Key Simplifications

Compared to the blue/green deployment:

| Component | Blue/Green (Old) | Simplified (New) |
|-----------|------------------|------------------|
| ECS Clusters | 2 (blue + green) | 1 (single) |
| Target Groups | 2 (blue + green) | 1 (single) |
| Deployment State | Complex state management | Direct deployment |
| Environment Variables | 100+ blue/green specific | ~10 consolidated |
| Database | Blue/green sync required | Single shared database |
| Traffic Switching | Complex ALB rules | Direct routing |

## Database Management

### Creating Backups

```bash
# Create backup for staging
./scripts/backup-database.sh -e staging

# Create named backup for production
./scripts/backup-database.sh -e production -n pre-migration

# Create local backup only (no S3 upload)
./scripts/backup-database.sh -e staging --no-s3 --keep-local
```

### Restoring Backups

Use the GitHub Action for safe database restoration:

1. Go to **Actions** tab in your GitHub repository
2. Find and click on **"Restore Database Backup"** workflow
3. Click **"Run workflow"** button
4. Select environment and enter the backup file path (e.g., `database-backups/2024/01/15/backup_name.sql`)
5. **Check the confirmation checkbox** (this will overwrite existing data!)
6. Click **"Run workflow"** to start the restoration

The restore process will:
- Stop ECS services to prevent conflicts
- Create a pre-restore backup for safety
- Restore the specified backup
- Restart ECS services
- Verify service health

## Monitoring and Troubleshooting

### Checking Deployment Status

```bash
# Get deployment information
cd deployment/environments/staging
terraform output

# Check ECS service status
aws ecs describe-services \
  --cluster grants-stack-indexer-staging-cluster \
  --services grants-stack-indexer-api-service

# Check service logs
aws logs tail /ecs/grants-stack-indexer-staging --follow
```

### Health Checks

The deployment includes built-in health checks:

- **Load Balancer Health Check**: `GET /health` on port 3000
- **ECS Task Health Check**: Container-level health monitoring
- **Auto-scaling**: CPU-based scaling (1-3 instances)

### Common Issues

#### 1. Terraform State Issues
```bash
# Refresh Terraform state
terraform refresh

# Import existing resources if needed
terraform import aws_ecs_cluster.main grants-stack-indexer-staging-cluster
```

#### 2. ECS Service Won't Start
```bash
# Check service events
aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME

# Check task definition
aws ecs describe-task-definition --task-definition TASK_DEFINITION_ARN

# Check logs
aws logs get-log-events --log-group-name /ecs/grants-stack-indexer-staging
```

#### 3. Database Connection Issues
```bash
# Test database connectivity from bastion host
# (Use the bastion host created by the networking module)

# Check RDS status
aws rds describe-db-instances --db-instance-identifier grants-stack-indexer-staging-rds
```

## Environment Configuration

### Staging Environment

- **Purpose**: Development and testing
- **Auto-deploy**: On push to `staging` branch
- **Database**: Separate staging database
- **Scaling**: Minimal (1 instance)
- **Monitoring**: Basic CloudWatch logs

### Production Environment

- **Purpose**: Live application
- **Auto-deploy**: On push to `main` branch
- **Database**: Production database with backups
- **Scaling**: Auto-scaling (1-3 instances)
- **Monitoring**: Enhanced monitoring and alerting

## Security Considerations

### Network Security
- ECS tasks run in private subnets
- Database is not publicly accessible
- Load balancer handles public traffic
- Security groups restrict access

### Data Security
- Database encryption at rest
- S3 buckets encrypted and private
- Secrets managed through AWS Secrets Manager
- IAM roles follow least privilege principle

### Backup Security
- Database backups encrypted in S3
- Backup retention policy (365 days)
- Pre-restore backups for safety
- Access logging enabled

## Migration from Blue/Green

If you're migrating from the old blue/green deployment:

### 1. Data Migration
```bash
# Create final backup of blue/green database
./scripts/backup-database.sh -e production -n final-blue-green-backup

# Deploy new infrastructure
./scripts/deploy-simple.sh -e production

# Restore data to new database
# Use GitHub Action: Restore Database Backup
```

### 2. DNS Update
Update your DNS records to point to the new load balancer:
```bash
# Get new load balancer DNS
cd deployment/environments/production
terraform output load_balancer_dns_name
```

### 3. Cleanup Old Resources
After verifying the new deployment works:
```bash
# Remove old blue/green infrastructure
# (This should be done carefully, preferably with Terraform destroy)
```

## Support and Troubleshooting

### Getting Help

1. **Check the logs**: CloudWatch logs contain detailed error information
2. **Review Terraform output**: Most configuration issues show up in Terraform plan/apply
3. **Verify environment variables**: Ensure all required variables are set
4. **Test database connectivity**: Use the backup script to verify database access

### Useful Commands

```bash
# View all ECS clusters
aws ecs list-clusters

# View services in a cluster
aws ecs list-services --cluster CLUSTER_NAME

# View running tasks
aws ecs list-tasks --cluster CLUSTER_NAME --service-name SERVICE_NAME

# Get service logs
aws logs describe-log-groups --log-group-name-prefix /ecs/grants-stack-indexer

# Check Terraform state
terraform show
terraform state list
```

This simplified deployment provides the same functionality as the blue/green setup but with significantly reduced complexity and operational overhead.
