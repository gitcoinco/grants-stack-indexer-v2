# Deployment Module

## Overview

The `deployment` module is responsible for managing the infrastructure deployment for the Grants Stack Indexer project. It utilizes Terraform to provision and manage AWS resources, ensuring a scalable and reliable environment for the application.

## 🚀 Getting Started

### Prerequisites

Before using this module, ensure you have the following installed:

-   [Terraform](https://www.terraform.io/downloads.html) (version >= 1.0.0)
-   [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate permissions

### Module Structure

The `deployment` module is organized into several submodules, each responsible for different aspects of the infrastructure:

-   **Networking**: Manages VPC, subnets, and security groups.
-   **IAM**: Handles IAM roles and policies for the application services.
-   **Compute**: Configures ECS clusters and services for running the application.
-   **Storage**: Manages RDS instances and other storage solutions.
-   **Load Balancer**: Sets up application load balancers for routing traffic.
-   **Container Registry**: Manages ECR repositories for storing Docker images.
-   **Bastion**: Provides a bastion host for secure access to the VPC.

### Usage

To use the deployment module, follow these steps:

1. Copy the `terraform.tfvars.example` file to `terraform.tfvars` and update the variables with your desired values.

```bash
cp terraform.tfvars.example terraform.tfvars
```

2. Initialize the Terraform workspace:

```bash
terraform init
```

3. Review the deployment plan:

```bash
terraform plan
```

4. Apply the changes:

```bash
terraform apply
```

5. Destroy the infrastructure (when needed):

```bash
terraform destroy
```

## Variables

| Variable Name                                    | Description                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `app_name`                                       | The name of the application.                                                                                             |
| `app_environment`                                | The environment in which the application is running (e.g., dev, staging, prod).                                          |
| `region`                                         | The AWS region where the resources will be deployed.                                                                     |
| `db_name`                                        | The name of the RDS database to be created.                                                                              |
| `rds_username`                                   | The username for the RDS database.                                                                                       |
| `rds_password`                                   | The password for the RDS database.                                                                                       |
| `rds_security_group_id`                          | The ID of the RDS security group.                                                                                        |
| `rds_subnet_ids`                                 | The subnet IDs for the RDS instance.                                                                                     |
| `rds_subnet_group_name`                          | The name of the RDS subnet group.                                                                                        |
| `processing_image_tag`                           | The tag of the processing Docker image.                                                                                  |
| `api_repository_url`                             | The URL of the ECR repository where the API Docker image is stored.                                                      |
| `api_image_tag`                                  | The tag of the Docker image for the API.                                                                                 |
| `NODE_ENV`                                       | The Node environment.                                                                                                    |
| `RETRY_MAX_ATTEMPTS`                             | The maximum number of retry attempts.                                                                                    |
| `RETRY_BASE_DELAY_MS`                            | The base delay in milliseconds for retries.                                                                              |
| `RETRY_MAX_DELAY_MS`                             | The maximum delay in milliseconds for retries.                                                                           |
| `RETRY_FACTOR`                                   | The factor to increase the delay for retries.                                                                            |
| `CHAINS`                                         | Chains to be indexed, defined as a list of objects containing `id`, `name`, `rpcUrls`, `fetchLimit`, and `fetchDelayMs`. |
| `INDEXER_GRAPHQL_URL`                            | The URL for the Indexer GraphQL API.                                                                                     |
| `METADATA_SOURCE`                                | The source of metadata.                                                                                                  |
| `PUBLIC_GATEWAY_URLS`                            | A list of public gateway URLs.                                                                                           |
| `PRICING_SOURCE`                                 | The source for pricing data.                                                                                             |
| `COINGECKO_API_KEY`                              | The API key for Coingecko.                                                                                               |
| `COINGECKO_API_TYPE`                             | The type of Coingecko API to use (e.g., pro).                                                                            |
| `LOG_LEVEL`                                      | The logging level for the application.                                                                                   |
| `DATALAYER_PG_USER`                              | The username for the PostgreSQL database.                                                                                |
| `DATALAYER_PG_PASSWORD`                          | The password for the PostgreSQL database.                                                                                |
| `DATALAYER_PG_DB_NAME`                           | The name of the PostgreSQL database.                                                                                     |
| `DATALAYER_PG_EXPOSED_PORT`                      | The port on which the PostgreSQL database is exposed.                                                                    |
| `DATALAYER_HASURA_EXPOSED_PORT`                  | The port on which the Hasura GraphQL engine is exposed.                                                                  |
| `DATALAYER_HASURA_ENABLE_CONSOLE`                | Whether to enable the Hasura console.                                                                                    |
| `DATALAYER_HASURA_ADMIN_SECRET`                  | The admin secret for Hasura.                                                                                             |
| `DATALAYER_HASURA_UNAUTHORIZED_ROLE`             | The unauthorized role for Hasura.                                                                                        |
| `DATALAYER_HASURA_CORS_DOMAIN`                   | The CORS domain for Hasura.                                                                                              |
| `DATALAYER_HASURA_ENABLE_TELEMETRY`              | Whether to enable telemetry for Hasura.                                                                                  |
| `DATALAYER_HASURA_DEV_MODE`                      | Whether to enable development mode for Hasura.                                                                           |
| `DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS`         | Whether to enable internal errors for Hasura.                                                                            |
| `DATALAYER_HASURA_CONSOLE_ASSETS_DIR`            | The directory for console assets in Hasura.                                                                              |
| `DATALAYER_HASURA_EXPERIMENTAL_FEATURES`         | The experimental features for Hasura.                                                                                    |
| `DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION`     | The default naming convention for Hasura.                                                                                |
| `DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT` | Whether to enable BigQuery string numeric input for Hasura.                                                              |

## To deploy a docker image to the ECR repository using aws cli

```bash
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY_URL}
docker build -t gitcoin-data-layer:latest .
docker tag gitcoin-data-layer:latest ${ECR_REPOSITORY_URL}/gitcoin-data-layer:latest
docker push ${ECR_REPOSITORY_URL}/gitcoin-data-layer:latest
```
