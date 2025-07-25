#!/bin/bash

# Simplified Deployment Script
# Replaces the complex blue/green deployment with a single-service deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# Default values
ENVIRONMENT=""
IMAGE_TAG="latest"
SKIP_BUILD=false
SKIP_TESTS=false
AUTO_APPROVE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Simplified deployment script for single ECS service + RDS setup.

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (staging|production) [required]
    -t, --tag IMAGE_TAG             Docker image tag to deploy (default: latest)
    -s, --skip-build                Skip building and pushing Docker image
    --skip-tests                    Skip running tests before deployment
    --auto-approve                  Auto-approve Terraform changes (use with caution)
    -h, --help                      Show this help message

EXAMPLES:
    $0 -e staging                   Deploy latest image to staging
    $0 -e production -t v1.2.3      Deploy specific tag to production
    $0 -e staging --skip-build      Deploy without building new image
    $0 -e production --auto-approve Deploy to production with auto-approval

ENVIRONMENT VARIABLES:
    AWS_REGION                      AWS region (required)
    APP_NAME                        Application name (required)
    TERRAFORM_STATE_BUCKET          S3 bucket for Terraform state (required)
    
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment is required. Use -e or --environment."
    show_usage
    exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Environment must be 'staging' or 'production'"
    exit 1
fi

# Validate required environment variables
required_vars=("AWS_REGION" "APP_NAME" "TERRAFORM_STATE_BUCKET")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        log_error "Environment variable $var is required"
        exit 1
    fi
done

log_info "Starting simplified deployment..."
log_info "Environment: $ENVIRONMENT"
log_info "Image Tag: $IMAGE_TAG"
log_info "AWS Region: $AWS_REGION"
log_info "App Name: $APP_NAME"

# Step 1: Run tests (unless skipped)
if [[ "$SKIP_TESTS" != true ]]; then
    log_info "Running tests..."
    cd "$PROJECT_ROOT"
    
    if ! pnpm run lint; then
        log_error "Linting failed"
        exit 1
    fi
    
    if ! pnpm run test; then
        log_error "Tests failed"
        exit 1
    fi
    
    log_success "Tests passed"
else
    log_warning "Skipping tests"
fi

# Step 2: Build and push Docker image (unless skipped)
if [[ "$SKIP_BUILD" != true ]]; then
    log_info "Building and pushing Docker image..."
    
    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    # Build image
    ECR_REPOSITORY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}"
    docker build -t "$ECR_REPOSITORY:$IMAGE_TAG" "$PROJECT_ROOT"
    
    # Push image
    docker push "$ECR_REPOSITORY:$IMAGE_TAG"
    
    log_success "Docker image built and pushed: $ECR_REPOSITORY:$IMAGE_TAG"
else
    log_warning "Skipping Docker build"
fi

# Step 3: Deploy infrastructure with Terraform
log_info "Deploying infrastructure with Terraform..."

TERRAFORM_DIR="$DEPLOYMENT_DIR/environments/$ENVIRONMENT"
cd "$TERRAFORM_DIR"

# Initialize Terraform
terraform init \
    -backend-config="bucket=$TERRAFORM_STATE_BUCKET" \
    -backend-config="key=$APP_NAME/$ENVIRONMENT/terraform.tfstate" \
    -backend-config="region=$AWS_REGION"

# Validate Terraform configuration
if ! terraform validate; then
    log_error "Terraform validation failed"
    exit 1
fi

# Plan deployment
log_info "Planning Terraform deployment..."
export TF_VAR_IMAGE_TAG="$IMAGE_TAG"
terraform plan -out=tfplan

# Apply deployment
if [[ "$AUTO_APPROVE" == true ]]; then
    log_warning "Auto-approving Terraform changes..."
    terraform apply -auto-approve tfplan
else
    log_info "Review the plan above and confirm deployment:"
    terraform apply tfplan
fi

# Step 4: Get deployment outputs
log_info "Getting deployment information..."
LOAD_BALANCER_DNS=$(terraform output -raw load_balancer_dns_name)
CLUSTER_NAME=$(terraform output -raw cluster_name)

# Step 5: Force ECS service update
log_info "Updating ECS service..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$APP_NAME-api-service" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

# Step 6: Wait for deployment to stabilize
log_info "Waiting for deployment to complete..."
aws ecs wait services-stable \
    --cluster "$CLUSTER_NAME" \
    --services "$APP_NAME-api-service" \
    --region "$AWS_REGION"

# Step 7: Health check
log_info "Performing health check..."
HEALTH_URL="http://$LOAD_BALANCER_DNS/health"

# Wait a bit for the load balancer to update
sleep 30

for i in {1..10}; do
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        log_success "Health check passed"
        break
    else
        if [[ $i -eq 10 ]]; then
            log_error "Health check failed after 10 attempts"
            exit 1
        fi
        log_info "Health check attempt $i failed, retrying in 30 seconds..."
        sleep 30
    fi
done

# Deployment summary
log_success "🚀 Deployment completed successfully!"
echo ""
echo "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Image Tag: $IMAGE_TAG"
echo "  Load Balancer: $LOAD_BALANCER_DNS"
echo "  ECS Cluster: $CLUSTER_NAME"
echo "  Health Check: $HEALTH_URL"
echo ""
log_info "Your application is now available at: http://$LOAD_BALANCER_DNS"
