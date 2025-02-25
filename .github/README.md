# GitHub Workflows

This directory contains the GitHub Actions workflows for the Grants Stack Indexer project. These workflows handle continuous integration, testing, and deployment processes.

## Available Workflows

| Workflow               | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `main-workflow.yml`    | Main CI pipeline triggered on PR to dev/main       |
| `build.yml`            | Handles project building and type checking         |
| `build-image.yml`      | Builds and validates Docker images                 |
| `lint.yml`             | Runs code linting and commit message validation    |
| `test.yml`             | Executes unit tests with coverage                  |
| `test-integration.yml` | Runs integration tests                             |
| `deploy.yaml`          | Handles terraform deployment to staging/production |
| `push-to-ecr.yaml`     | Pushes Docker images to Amazon ECR                 |

## Main Workflow

The main workflow (`main-workflow.yml`) is triggered on pull requests to `dev` and `main` branches. It orchestrates the following jobs in sequence:

1. Build
2. Build Image
3. Lint (after Build)
4. Tests (after Lint)
5. Integration Tests (after Lint)

## Deployment

The deployment workflow (`deploy.yaml`) is manually triggered and includes:

-   Environment validation (staging/production)
-   Admin permission checks
-   Terraform deployment steps

### Usage

To trigger a deployment:

1. Go to Actions > Terraform Deployment with Docker Tag
2. Click "Run workflow"
3. Enter:
    - Docker image tag
    - Deployment environment (staging/production)

### Required Secrets

For deployment to work, the following secrets must be configured:

#### Staging Environment

-   `STAGING_AWS_REGION`
-   `STAGING_TF_BACKEND_BUCKET`
-   `STAGING_TF_BACKEND_KEY`

#### Production Environment

-   `PROD_AWS_REGION`
-   `PROD_TF_BACKEND_BUCKET`
-   `PROD_TF_BACKEND_KEY`

## Docker Image Management

### Building Images

The `build-image.yml` workflow:

-   Uses Docker Buildx
-   Implements layer caching
-   Targets the processing stage

### ECR Push

The `push-to-ecr.yaml` workflow automatically pushes images to Amazon ECR when changes are pushed to the `dev` branch.

Required secrets for ECR:

-   `ECR_REGISTRY`
-   `ECR_REPOSITORY`
-   `AWS_ACCESS_KEY_ID`
-   `AWS_SECRET_ACCESS_KEY`
-   `AWS_REGION`
