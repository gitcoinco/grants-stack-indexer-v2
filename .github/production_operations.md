# Production Operations

This guide is for production operations on the Gitcoin Data Layer.

## Architecture diagram

![Architecture diagram](./architecture_diagram.png)

## First Deployment

Fill the secrets and variables in github actions secrets and variables. those are:

Repository secrets:

-   `AWS_ACCESS_KEY_ID`
-   `AWS_SECRET_ACCESS_KEY`
-   `COINGECKO_API_KEY`
-   `HASURA_ADMIN_SECRET`
-   `DATA_LAYER_DB_PASSWORD`
-   `DATA_LAYER_DB_USER`
-   `ECR_REGISTRY`
-   `ECR_REPOSITORY`

Repository Variables:

-   `APP_NAME`
-   `AWS_REGION`
-   `TERRAFORM_VARS` (Mostly all the changes will be just the image tags)

example TERRAFORM_VARS:

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

Once variables are set, you can deploy the first time by running the `Deploy to AWS (First deployment)` workflow.

Follow this instructions to make the first deployment work:

1. Log in to your AWS account
2. Copy your database endpoint from RDS > Databases > gitcoin-data-layer-staging-rds > Connectivity and security > Endpoint
3. Go to EC2 > Instances > gitcoin-data-layer-production-bastion > Connect > Session Manager > Connect ( IF YOU CAN’T USE `SessionManager` try rebooting the instance)
4. Once in the terminal run:

    1. sudo su
    2. cd ~
    3. git clone https://github.com/defi-wonderland/grants-stack-indexer-v2.git
    4. cd grants-stack-indexer-v2
    5. set env variables for scripts

        1. `nano ./scripts/migrations/.env`

            ```tsx
            DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerGreen
            DATABASE_SCHEMA=public
            NODE_ENV=production
            ```

    6. chmod +x ./deployment/bastion_scripts/install_dependencies.sh
    7. ./deployment/bastion_scripts/install_dependencies.sh
    8. source ~/.bashrc
    9. pnpm i && pnpm build
    10. pnpm db:create-databases

    ### Migrate cache: Run 2 times, first green, blue after.

    1. `nano ./scripts/migrations/.env`

        ```tsx
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerGreen
        DATABASE_SCHEMA=public
        NODE_ENV=production

        ```

    2. pnpm db:cache:migrate
    3. nano ./scripts/migrations/.env

        ```tsx
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerBlue
        DATABASE_SCHEMA=public
        NODE_ENV=production
        ```

    4. pnpm db:cache:migrate

    ### Bootstrap Green database

    1. `nano ./scripts/bootstrap/.env`

        ```tsx
        NODE_ENV=production
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerGreen
        DATABASE_SCHEMA=public
        INDEXER_URL={{INDEXER_URL}}
        PUBLIC_GATEWAY_URLS=[...{{ IPFS_PUBLIC_GATEWAYS}}]
        CHAIN_IDS=[10,1]
        LOG_LEVEL=info
        PRICING_SOURCE=coingecko
        COINGECKO_API_KEY=CG-{{YOUR_COINGECKO_API_KEY}}
        COINGECKO_API_TYPE=pro

        ```

    2. pnpm bootstrap:metadata
    3. pnpm bootstrap:pricing

    ### Migrate processing tables: Run 2 times, first green, blue after.

    1. `nano ./scripts/migrations/.env`

        ```tsx
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerGreen
        DATABASE_SCHEMA=public
        NODE_ENV=production
        ```

    2. pnpm db:migrate
    3. nano ./scripts/migrations/.env

        ```tsx
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayerBlue
        DATABASE_SCHEMA=public
        NODE_ENV=production
        ```

    4. pnpm db:migrate

### Configure API

1. `nano ./scripts/hasura-config/.env`

    ```tsx
    HASURA_ENDPOINT={{API_GW_URL}}
    HASURA_ADMIN_SECRET={{YOUR_HASURA_ADMIN_SECRET}}
    HASURA_SCHEMA=public
    ```

2. pnpm api:configure

## Upgrade using blue deployment

1. Update the TERRAFORM_VARS with the new image tag, or changes. (You can run `Current Deployment State` workflow to see the current state of the deployment, and the active environment. If the deployment state is `single`, it means that there is just one deployment and is the active one. If the deployment state is `deployment`, it means that there are two deployments, the blue and the green, and the active environment is `active_deployment`.)
2. Run `Deploy Blue Green (Start upgrade - Step 1)` workflow and deploy the target deployment
3. Follow the instructions to set up the target deployment:

    - Set migrations with target environment nano ./scripts/migrations/.env
        ```tsx
        DATABASE_URL=postgres://{{DB_USER}}:{{DB_PASSWORD}}@{{DB_URL}}:5432/GitcoinDatalayer{{Green|Blue(Should be target environment)}}
        DATABASE_SCHEMA=public
        NODE_ENV=production
        ```
    - pnpm db:reset
    - pnpm db:copy-cache -f {{ green | blue (should be the source environment) }}
    - pnpm db:migrate

4. Wait until the new deployment is stable.
5. Run `Promote Blue Green (Start upgrade - Step 2)` workflow
6. Validate that is stable and working (You can rollback running again `Promote Blue Green (Start upgrade - Step 2)`)
7. Once you are sure that the new deployment is stable, you can destroy the old deployment by running `Destroy Blue Green (Start upgrade - Step 3)` workflow
