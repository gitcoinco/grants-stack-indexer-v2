#!/bin/bash

# Database Backup Script
# Creates backups of the RDS database and uploads to S3

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# Default values
ENVIRONMENT=""
BACKUP_NAME=""
UPLOAD_TO_S3=true
KEEP_LOCAL=false

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

Creates a backup of the RDS database and optionally uploads to S3.

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (staging|production) [required]
    -n, --name BACKUP_NAME          Custom backup name (default: auto-generated)
    --no-s3                         Don't upload backup to S3
    --keep-local                    Keep local backup file after upload
    -h, --help                      Show this help message

EXAMPLES:
    $0 -e staging                   Create backup for staging
    $0 -e production -n pre-deploy  Create named backup for production
    $0 -e staging --no-s3           Create local backup only

ENVIRONMENT VARIABLES:
    AWS_REGION                      AWS region (required)
    APP_NAME                        Application name (required)
    DATALAYER_PG_USER              Database username (required)
    DATALAYER_PG_PASSWORD          Database password (required)
    DATALAYER_PG_DB_NAME           Database name (optional, default: grants_stack_indexer)
    
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --no-s3)
            UPLOAD_TO_S3=false
            shift
            ;;
        --keep-local)
            KEEP_LOCAL=true
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
required_vars=("AWS_REGION" "APP_NAME" "DATALAYER_PG_USER" "DATALAYER_PG_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        log_error "Environment variable $var is required"
        exit 1
    fi
done

# Set default database name if not provided
DATALAYER_PG_DB_NAME="${DATALAYER_PG_DB_NAME:-grants_stack_indexer}"

# Generate backup name if not provided
if [[ -z "$BACKUP_NAME" ]]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="database_backup_${TIMESTAMP}"
fi

log_info "Starting database backup..."
log_info "Environment: $ENVIRONMENT"
log_info "Backup Name: $BACKUP_NAME"
log_info "Database: $DATALAYER_PG_DB_NAME"

# Step 1: Get database connection details from Terraform
log_info "Getting database connection details..."

TERRAFORM_DIR="$DEPLOYMENT_DIR/environments/$ENVIRONMENT"
cd "$TERRAFORM_DIR"

# Initialize Terraform to read state
terraform init \
    -backend-config="bucket=${APP_NAME}-${ENVIRONMENT}-terraform-state" \
    -backend-config="key=$APP_NAME/$ENVIRONMENT/terraform.tfstate" \
    -backend-config="region=$AWS_REGION" > /dev/null

# Get RDS endpoint
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
if [[ -z "$RDS_ENDPOINT" ]]; then
    log_error "Could not retrieve RDS endpoint from Terraform state"
    log_error "Make sure the infrastructure is deployed and Terraform state is accessible"
    exit 1
fi

log_info "RDS Endpoint: $RDS_ENDPOINT"

# Step 2: Create backup directory
BACKUP_DIR="$PROJECT_ROOT/temp-backups"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"
DATABASE_URL="postgresql://${DATALAYER_PG_USER}:${DATALAYER_PG_PASSWORD}@${RDS_ENDPOINT}/${DATALAYER_PG_DB_NAME}"

# Step 3: Test database connection
log_info "Testing database connection..."
if ! pg_isready -h "$RDS_ENDPOINT" -U "$DATALAYER_PG_USER" -t 10; then
    log_error "Cannot connect to database at $RDS_ENDPOINT"
    exit 1
fi

log_success "Database connection verified"

# Step 4: Create database backup
log_info "Creating database backup..."
if ! pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
    log_error "Failed to create database backup"
    exit 1
fi

# Check if backup file was created and has content
if [[ ! -f "$BACKUP_FILE" ]] || [[ ! -s "$BACKUP_FILE" ]]; then
    log_error "Backup file is empty or was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_success "Database backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Step 5: Upload to S3 (if enabled)
if [[ "$UPLOAD_TO_S3" == true ]]; then
    log_info "Uploading backup to S3..."
    
    BACKUP_BUCKET="${APP_NAME}-${ENVIRONMENT}-backups"
    S3_KEY="database-backups/$(date +%Y/%m/%d)/${BACKUP_NAME}.sql"
    S3_PATH="s3://${BACKUP_BUCKET}/${S3_KEY}"
    
    # Check if backup bucket exists
    if ! aws s3api head-bucket --bucket "$BACKUP_BUCKET" --region "$AWS_REGION" &>/dev/null; then
        log_error "Backup bucket does not exist: $BACKUP_BUCKET"
        log_error "Run './scripts/setup-infrastructure.sh -e $ENVIRONMENT' to create it"
        exit 1
    fi
    
    # Upload backup
    if aws s3 cp "$BACKUP_FILE" "$S3_PATH" --region "$AWS_REGION"; then
        log_success "Backup uploaded to: $S3_PATH"
        
        # Add metadata
        aws s3api put-object-tagging \
            --bucket "$BACKUP_BUCKET" \
            --key "$S3_KEY" \
            --tagging "TagSet=[{Key=Environment,Value=$ENVIRONMENT},{Key=BackupType,Value=database},{Key=CreatedBy,Value=backup-script}]" \
            --region "$AWS_REGION"
        
    else
        log_error "Failed to upload backup to S3"
        exit 1
    fi
else
    log_warning "Skipping S3 upload"
fi

# Step 6: Cleanup local file (if not keeping)
if [[ "$KEEP_LOCAL" != true ]] && [[ "$UPLOAD_TO_S3" == true ]]; then
    rm "$BACKUP_FILE"
    log_info "Local backup file removed"
elif [[ "$KEEP_LOCAL" == true ]]; then
    log_info "Local backup kept at: $BACKUP_FILE"
fi

# Remove backup directory if empty
if [[ -d "$BACKUP_DIR" ]] && [[ -z "$(ls -A "$BACKUP_DIR")" ]]; then
    rmdir "$BACKUP_DIR"
fi

# Summary
log_success "🎉 Database backup completed successfully!"
echo ""
echo "Backup Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Database: $DATALAYER_PG_DB_NAME"
echo "  Backup Name: $BACKUP_NAME"
echo "  Size: $BACKUP_SIZE"
if [[ "$UPLOAD_TO_S3" == true ]]; then
    echo "  S3 Location: $S3_PATH"
fi
if [[ "$KEEP_LOCAL" == true ]]; then
    echo "  Local File: $BACKUP_FILE"
fi
echo ""
if [[ "$UPLOAD_TO_S3" == true ]]; then
    log_info "To restore this backup, use: ./.github/workflows/restore-database.yml"
    log_info "Backup S3 path: database-backups/$(date +%Y/%m/%d)/${BACKUP_NAME}.sql"
fi
