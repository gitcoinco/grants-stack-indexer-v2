# Processor Service

This service is the main application that runs the core processing pipeline:

-   Instantiates and coordinates components from [Grants Stack Indexer packages](../../packages/)
-   Creates and manages an Orchestrator per chain to process blockchain events

## Requirements

-   A running instance of PostgreSQL Data Layer with migrations applied
-   A running instance of Envio Indexer

## Setup

1. Install dependencies running `pnpm install`
2. Build the app using `pnpm build`

### ⚙️ Setting up env variables

-   Create `.env` file and copy paste `.env.example` content in there or run the following command:

```
$ cp .env.example .env
```

Available options:
| Name | Description | Default | Required | Notes |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------|-----------|----------------------------------|-----------------------------------------------------------------|
| `RPC_URLS` | Array of RPC URLs | N/A | Yes | Multiple URLs for redundancy |
| `CHAIN_ID` | Chain ID | N/A | Yes | At the moment only Optimism is supported (10) |
| `FETCH_LIMIT` | Maximum number of items to fetch in one batch | 500 | No | |
| `FETCH_DELAY_MS` | Delay between fetch operations in milliseconds | 1000 | No | |
| `DATABASE_URL` | PostgreSQL Data Layer database connection URL | N/A | Yes | |
| `DATABASE_SCHEMA` | PostgreSQL Data Layer database schema name | public | Yes | |
| `INDEXER_GRAPHQL_URL` | GraphQL endpoint for the indexer | N/A | Yes | |
| `INDEXER_ADMIN_SECRET` | Admin secret for indexer authentication | N/A | Yes | |
| `IPFS_GATEWAYS_URL` | Array of IPFS gateway URLs | N/A | Yes | Multiple gateways for redundancy |
| `COINGECKO_API_KEY` | API key for CoinGecko service | N/A | Yes | |
| `COINGECKO_API_TYPE` | CoinGecko API tier (demo or pro) | pro | No | |

## Available Scripts

Available scripts that can be run using `pnpm`:

| Script        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `build`       | Build library using tsc                                 |
| `check-types` | Check types issues using tsc                            |
| `clean`       | Remove `dist` folder                                    |
| `dev`         | Run the app in development mode using tsx               |
| `dev:watch`   | Run the app in watch mode for development               |
| `lint`        | Run ESLint to check for coding standards                |
| `lint:fix`    | Run linter and automatically fix code formatting issues |
| `format`      | Check code formatting and style using Prettier          |
| `format:fix`  | Run formatter and automatically fix issues              |
| `start`       | Run the compiled app from dist folder                   |
| `test`        | Run tests using vitest                                  |
| `test:cov`    | Run tests with coverage report                          |

TODO: e2e tests
TODO: Docker image
