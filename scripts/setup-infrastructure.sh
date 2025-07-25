#!/bin/bash

# Infrastructure Setup Script
# Sets up the basic AWS infrastructure for the simplified deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT=""
CREATE_ECR=true
CREATE_S3=true
FORCE_RECREATE=false

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

Sets up the basic AWS infrastructure for simplified deployment.

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (staging|production) [required]
    --skip-ecr                      Skip ECR repository creation
    --skip-s3                       Skip S3 bucket creation
    --force-recreate                Force recreate existing resources
    -h, --help                      Show this help message

EXAMPLES:
    $0 -e staging                   Setup staging infrastructure
    $0 -e production --skip-ecr     Setup production without ECR
    $0 -e staging --force-recreate  Recreate staging infrastructure

ENVIRONMENT VARIABLES:
    AWS_REGION                      AWS region (required)
    APP_NAME                        Application name (required)
    
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-ecr)
            CREATE_ECR=false
            shift
            ;;
        --skip-s3)
            CREATE_S3=false
            shift
            ;;
        --force-recreate)
            FORCE_RECREATE=true
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
required_vars=("AWS_REGION" "APP_NAME")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        log_error "Environment variable $var is required"
        exit 1
    fi
done

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [[ -z "$AWS_ACCOUNT_ID" ]]; then
    log_error "Failed to get AWS account ID. Check your AWS credentials."
    exit 1
fi

log_info "Setting up infrastructure for $ENVIRONMENT environment..."
log_info "AWS Region: $AWS_REGION"
log_info "App Name: $APP_NAME"
log_info "AWS Account: $AWS_ACCOUNT_ID"

# Step 1: Create ECR repository
if [[ "$CREATE_ECR" == true ]]; then
    log_info "Creating ECR repository..."
    
    ECR_REPO_NAME="$APP_NAME"
    
    # Check if repository exists
    if aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" &>/dev/null; then
        if [[ "$FORCE_RECREATE" == true ]]; then
            log_warning "Deleting existing ECR repository..."
            aws ecr delete-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION" --force
        else
            log_info "ECR repository already exists: $ECR_REPO_NAME"
        fi
    fi
    
    # Create repository if it doesn't exist or was deleted
    if ! aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" &>/dev/null; then
        aws ecr create-repository \
            --repository-name "$ECR_REPO_NAME" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        
        # Set lifecycle policy to manage image retention
        aws ecr put-lifecycle-policy \
            --repository-name "$ECR_REPO_NAME" \
            --region "$AWS_REGION" \
            --lifecycle-policy-text '{
                "rules": [
                    {
                        "rulePriority": 1,
                        "description": "Keep last 10 images",
                        "selection": {
                            "tagStatus": "tagged",
                            "countType": "imageCountMoreThan",
                            "countNumber": 10
                        },
                        "action": {
                            "type": "expire"
                        }
                    },
                    {
                        "rulePriority": 2,
                        "description": "Delete untagged images older than 1 day",
                        "selection": {
                            "tagStatus": "untagged",
                            "countType": "sinceImagePushed",
                            "countUnit": "days",
                            "countNumber": 1
                        },
                        "action": {
                            "type": "expire"
                        }
                    }
                ]
            }'
        
        log_success "ECR repository created: $ECR_REPO_NAME"
    fi
    
    ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
    log_info "ECR URI: $ECR_URI"
else
    log_warning "Skipping ECR repository creation"
fi

# Step 2: Create S3 bucket for Terraform state
if [[ "$CREATE_S3" == true ]]; then
    log_info "Creating S3 bucket for Terraform state..."
    
    TERRAFORM_BUCKET="${APP_NAME}-${ENVIRONMENT}-terraform-state"
    
    # Check if bucket exists
    if aws s3api head-bucket --bucket "$TERRAFORM_BUCKET" --region "$AWS_REGION" &>/dev/null; then
        if [[ "$FORCE_RECREATE" == true ]]; then
            log_warning "Deleting existing S3 bucket..."
            aws s3 rb "s3://$TERRAFORM_BUCKET" --force
        else
            log_info "S3 bucket already exists: $TERRAFORM_BUCKET"
        fi
    fi
    
    # Create bucket if it doesn't exist or was deleted
    if ! aws s3api head-bucket --bucket "$TERRAFORM_BUCKET" --region "$AWS_REGION" &>/dev/null; then
        # Create bucket
        if [[ "$AWS_REGION" == "us-east-1" ]]; then
            aws s3api create-bucket --bucket "$TERRAFORM_BUCKET" --region "$AWS_REGION"
        else
            aws s3api create-bucket \
                --bucket "$TERRAFORM_BUCKET" \
                --region "$AWS_REGION" \
                --create-bucket-configuration LocationConstraint="$AWS_REGION"
        fi
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$TERRAFORM_BUCKET" \
            --versioning-configuration Status=Enabled
        
        # Enable server-side encryption
        aws s3api put-bucket-encryption \
            --bucket "$TERRAFORM_BUCKET" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }'
        
        # Block public access
        aws s3api put-public-access-block \
            --bucket "$TERRAFORM_BUCKET" \
            --public-access-block-configuration \
                BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
        
        log_success "S3 bucket created: $TERRAFORM_BUCKET"
    fi
    
    log_info "Terraform state bucket: s3://$TERRAFORM_BUCKET"
else
    log_warning "Skipping S3 bucket creation"
fi

# Step 3: Create backup S3 bucket
log_info "Creating S3 bucket for database backups..."

BACKUP_BUCKET="${APP_NAME}-${ENVIRONMENT}-backups"

# Check if backup bucket exists
if aws s3api head-bucket --bucket "$BACKUP_BUCKET" --region "$AWS_REGION" &>/dev/null; then
    if [[ "$FORCE_RECREATE" == true ]]; then
        log_warning "Deleting existing backup S3 bucket..."
        aws s3 rb "s3://$BACKUP_BUCKET" --force
    else
        log_info "Backup S3 bucket already exists: $BACKUP_BUCKET"
    fi
fi

# Create backup bucket if it doesn't exist or was deleted
if ! aws s3api head-bucket --bucket "$BACKUP_BUCKET" --region "$AWS_REGION" &>/dev/null; then
    # Create bucket
    if [[ "$AWS_REGION" == "us-east-1" ]]; then
        aws s3api create-bucket --bucket "$BACKUP_BUCKET" --region "$AWS_REGION"
    else
        aws s3api create-bucket \
            --bucket "$BACKUP_BUCKET" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BACKUP_BUCKET" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$BACKUP_BUCKET" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }'
    
    # Set lifecycle policy for backup retention
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BACKUP_BUCKET" \
        --lifecycle-configuration '{
            "Rules": [
                {
                    "ID": "BackupRetention",
                    "Status": "Enabled",
                    "Filter": {"Prefix": ""},
                    "Transitions": [
                        {
                            "Days": 30,
                            "StorageClass": "STANDARD_IA"
                        },
                        {
                            "Days": 90,
                            "StorageClass": "GLACIER"
                        }
                    ],
                    "Expiration": {
                        "Days": 365
                    }
                }
            ]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$BACKUP_BUCKET" \
        --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    
    log_success "Backup S3 bucket created: $BACKUP_BUCKET"
fi

log_info "Backup bucket: s3://$BACKUP_BUCKET"

# Summary
log_success "🎉 Infrastructure setup completed!"
echo ""
echo "Infrastructure Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  AWS Region: $AWS_REGION"
echo "  AWS Account: $AWS_ACCOUNT_ID"
if [[ "$CREATE_ECR" == true ]]; then
    echo "  ECR Repository: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}"
fi
if [[ "$CREATE_S3" == true ]]; then
    echo "  Terraform State: s3://${APP_NAME}-${ENVIRONMENT}-terraform-state"
fi
echo "  Backup Bucket: s3://${APP_NAME}-${ENVIRONMENT}-backups"
echo ""
log_info "You can now proceed with deployment using: ./scripts/deploy-simple.sh -e $ENVIRONMENT"
