# GitHub Workflows

This directory contains the GitHub Actions workflows for the Grants Stack Indexer project. These workflows handle continuous integration, testing, and deployment processes.

## Available Workflows

| Workflow                 | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `main-workflow.yml`      | Main CI pipeline triggered on PR to dev/main    |
| `build.yml`              | Handles project building and type checking      |
| `build-image.yml`        | Builds and validates Docker images              |
| `lint.yml`               | Runs code linting and commit message validation |
| `test.yml`               | Executes unit tests with coverage               |
| `test-integration.yml`   | Runs integration tests                          |
| `create-ecr.yml`         | Creates ECR repository in AWS                   |
| `create-s3.yaml`         | Creates S3 bucket for terraform state           |
| `deploy-to-aws.yaml`     | First-time deployment to AWS                    |
| `deploy-blue-green.yml`  | Handles blue-green deployment (Step 1)          |
| `promote-blue-green.yml` | Promotes blue-green deployment (Step 2)         |
| `destroy-blue-green.yml` | Finalizes blue-green deployment (Step 3)        |
| `destroy-deployment.yml` | Destroys environment resources                  |

## Main Workflow

The main workflow (`main-workflow.yml`) is triggered on pull requests to `dev` and `main` branches. It orchestrates the following jobs in sequence:

1. Build
2. Build Image
3. Lint (after Build)
4. Tests (after Lint)
5. Integration Tests (after Lint)

## Deployment

### Infrastructure Setup

Before deploying the application, you need to set up the basic infrastructure:

1. **Create S3 Bucket** (`create-s3.yaml`):

    - Creates bucket for Terraform state
    - Run once before the first deployment

2. **Create ECR Repository** (`create-ecr.yml`):
    - Sets up Docker image registry
    - Run once before the first deployment

### Base Deployment

Two workflows handle the base deployment operations:

1. **First Deployment** (`deploy-to-aws.yaml`):

    - Sets up initial infrastructure
    - Deploys green environment

2. **Environment Cleanup** (`destroy-deployment.yml`):
    - Removes all infrastructure
    - Use with caution

### Blue-Green Deployment

For updates, use the blue-green deployment process:

1. **Deploy** (`deploy-blue-green.yml`): Create new environment
2. **Promote** (`promote-blue-green.yml`): Switch traffic
3. **Cleanup** (`destroy-blue-green.yml`): Remove old environment

#### Blue-Green Deployment Details

The blue-green deployment process consists of three steps:

1. **Deploy New Environment** (`deploy-blue-green.yml`):

    - Creates a new environment (blue or green) alongside existing one
    - Deploys latest application version
    - New environment remains isolated from production traffic

2. **Promote Environment** (`promote-blue-green.yml`):

    - Switches traffic from old to new environment
    - Validates new environment health
    - Updates DNS/load balancer routing

3. **Cleanup Old Environment** (`destroy-blue-green.yml`):
    - Removes old environment after successful promotion
    - Releases unused resources
    - Completes deployment cycle

Each step requires manual trigger with environment selection (blue/green) to ensure controlled deployment process.

## Required Configuration

###Environment Variables and Secrets
To properly configure your GitHub repository, set up the following environment variables and secrets:

1. Add Repository Secrets
   Navigate to GitHub Repository Settings → Secrets and add:

-   `AWS_ACCESS_KEY_ID`
-   `AWS_SECRET_ACCESS_KEY`
-   `ECR_REGISTRY`
-   `ECR_REPOSITORY`

2. Add Repository Environment Variables
   Under GitHub Repository Settings → Environment Variables, add:

-   `APP_NAME`
-   `AWS_REGION`

3. Create GitHub Environments
   Set up two separate GitHub Environments:

-   `production`
-   `staging`

4. Add Secrets to GitHub Environments
   Within each environment (production and staging), add:

-   `COINGECKO_API_KEY`
-   `HASURA_ADMIN_SECRET`
-   `DATA_LAYER_DB_PASSWORD`
-   `DATA_LAYER_DB_USER`

5. Add Environment Variables to GitHub Environments
   Under Repository Environment Variables, add:

-   `TERRAFORM_VARS` (Primarily used for managing image tag updates)
    Example `TERRAFORM_VARS` configuration:

```json
{
    "GREEN_PROCESSING_IMAGE_TAG": "d8cece196697abbdafa5a7027e0b12f0ffe8bd77",
    "BLUE_PROCESSING_IMAGE_TAG": "d8cece196697abbdafa5a7027e0b12f0ffe8bd77",
    "GREEN_API_REPOSITORY_URL": "registry.hub.docker.com/hasura/graphql-engine",
    "GREEN_API_IMAGE_TAG": "v2.23.0",
    "GREEN_NODE_ENV": "production",
    "GREEN_RETRY_MAX_ATTEMPTS": 10,
    "GREEN_RETRY_BASE_DELAY_MS": 200,
    "GREEN_RETRY_MAX_DELAY_MS": 1000,
    "GREEN_RETRY_FACTOR": 1.5,
    "GREEN_CHAINS": [
        {
            "id": 10,
            "name": "optimism",
            "rpcUrls": [
                "https://optimism.llamarpc.com",
                "https://rpc.ankr.com/optimism",
                "https://optimism.gateway.tenderly.co",
                "https://optimism.blockpi.network/v1/rpc/public",
                "https://mainnet.optimism.io",
                "https://opt-mainnet.g.alchemy.com/v2/demo"
            ],
            "fetchLimit": 1000,
            "fetchDelayMs": 2000
        },
        {
            "id": 1,
            "name": "mainnet",
            "rpcUrls": ["https://eth.llamarpc.com", "https://rpc.flashbots.net/fast"],
            "fetchLimit": 1000,
            "fetchDelayMs": 2000
        }
    ],
    "GREEN_INDEXER_GRAPHQL_URL": "https://indexer.dev.hyperindex.xyz/e6a0458/v1/graphql",
    "GREEN_METADATA_SOURCE": "public-gateway",
    "GREEN_PUBLIC_GATEWAY_URLS": [
        "https://ipfs.io",
        "https://dweb.link",
        "https://cloudflare-ipfs.com",
        "https://gateway.pinata.cloud",
        "https://ipfs.infura.io",
        "https://ipfs.fleek.co",
        "https://ipfs.eth.aragon.network",
        "https://ipfs.jes.xxx",
        "https://ipfs.lol",
        "https://ipfs.mle.party"
    ],
    "GREEN_PRICING_SOURCE": "coingecko",
    "GREEN_COINGECKO_API_TYPE": "pro",
    "GREEN_LOG_LEVEL": "info",
    "GREEN_DATALAYER_PG_DB_NAME": "GitcoinDatalayerGreen",
    "BLUE_API_REPOSITORY_URL": "registry.hub.docker.com/hasura/graphql-engine",
    "BLUE_API_IMAGE_TAG": "v2.23.0",
    "BLUE_NODE_ENV": "production",
    "BLUE_RETRY_MAX_ATTEMPTS": 10,
    "BLUE_RETRY_BASE_DELAY_MS": 200,
    "BLUE_RETRY_MAX_DELAY_MS": 1000,
    "BLUE_RETRY_FACTOR": 1.5,
    "BLUE_CHAINS": [
        {
            "id": 10,
            "name": "optimism",
            "rpcUrls": [
                "https://optimism.llamarpc.com",
                "https://rpc.ankr.com/optimism",
                "https://optimism.gateway.tenderly.co",
                "https://optimism.blockpi.network/v1/rpc/public",
                "https://mainnet.optimism.io",
                "https://opt-mainnet.g.alchemy.com/v2/demo"
            ],
            "fetchLimit": 1000,
            "fetchDelayMs": 2000
        },
        {
            "id": 1,
            "name": "mainnet",
            "rpcUrls": ["https://eth.llamarpc.com", "https://rpc.flashbots.net/fast"],
            "fetchLimit": 1000,
            "fetchDelayMs": 2000
        }
    ],
    "BLUE_INDEXER_GRAPHQL_URL": "https://indexer.dev.hyperindex.xyz/e6a0458/v1/graphql",
    "BLUE_METADATA_SOURCE": "public-gateway",
    "BLUE_PUBLIC_GATEWAY_URLS": [
        "https://ipfs.io",
        "https://dweb.link",
        "https://cloudflare-ipfs.com",
        "https://gateway.pinata.cloud",
        "https://ipfs.infura.io",
        "https://ipfs.fleek.co",
        "https://ipfs.eth.aragon.network",
        "https://ipfs.jes.xxx",
        "https://ipfs.lol",
        "https://ipfs.mle.party"
    ],
    "BLUE_PRICING_SOURCE": "coingecko",
    "BLUE_COINGECKO_API_TYPE": "pro",
    "BLUE_LOG_LEVEL": "info",
    "BLUE_DATALAYER_PG_DB_NAME": "GitcoinDatalayerBlue"
}
```

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
