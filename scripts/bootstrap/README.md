# Grants Stack Indexer: Bootstrap Scripts

This package contains scripts for bootstrapping the grants-stack-indexer project, including metadata and pricing management.

## Available Scripts

| Script               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `bootstrap:metadata` | Runs the metadata bootstrap script                         |
| `bootstrap:pricing`  | Runs the pricing bootstrap script                          |
| `build`              | Compiles TypeScript files into JavaScript                  |
| `check-types`        | Checks for type issues using TypeScript                    |
| `clean`              | Removes the `dist` folder                                  |
| `format`             | Checks code formatting and style using Prettier            |
| `format:fix`         | Runs formatter and automatically fixes issues              |
| `lint`               | Runs ESLint to check for coding standards                  |
| `lint:fix`           | Runs linter and automatically fixes code formatting issues |
| `test`               | Runs tests using Vitest                                    |
| `test:cov`           | Runs tests with coverage report                            |

## Environment Setup

1. Create a `.env` file in the `scripts/bootstrap` directory:

    ```env
    # Database connection URL
    DATABASE_URL=postgre://postgres:testing@localhost:5434/datalayer-postgres-db
    # Database schema
    DATABASE_SCHEMA=public
    # Indexer URL
    INDEXER_URL="localhost:5432/v1/graphql"
    # Public gateway URLs
    PUBLIC_GATEWAY_URLS=["https://ipfs.io", "https://dweb.link", "https://cloudflare-ipfs.com", "https://gateway.pinata.cloud", "https://ipfs.infura.io", "https://ipfs.fleek.co", "https://ipfs.eth.aragon.network", "https://ipfs.jes.xxx", "https://ipfs.lol", "https://ipfs.mle.party"]
    # Chain IDs
    CHAIN_IDS=[1, 10, 42161]
    # Log level
    LOG_LEVEL=error
    # Pricing source
    PRICING_SOURCE=coingecko
    # Coingecko API key
    COINGECKO_API_KEY=CG-9B9jasdasdasd
    # Coingecko API type
    COINGECKO_API_TYPE=pro
    ```

### Environment Variables

| Variable              | Description               | Example                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection URL | `postgresql://user:password@localhost:5432/mydb`                                                                                                                                                                                                                      |
| `DATABASE_SCHEMA`     | Database schema           | `public`                                                                                                                                                                                                                                                              |
| `INDEXER_URL`         | Indexer URL               | `localhost:5432/v1/graphql`                                                                                                                                                                                                                                           |
| `PUBLIC_GATEWAY_URLS` | Public gateway URLs       | `["https://ipfs.io", "https://dweb.link", "https://cloudflare-ipfs.com", "https://gateway.pinata.cloud", "https://ipfs.infura.io", "https://ipfs.fleek.co", "https://ipfs.eth.aragon.network", "https://ipfs.jes.xxx", "https://ipfs.lol", "https://ipfs.mle.party"]` |
| `CHAIN_IDS`           | Chain IDs                 | `[1, 10, 42161]`                                                                                                                                                                                                                                                      |
| `LOG_LEVEL`           | Log level                 | `info`                                                                                                                                                                                                                                                                |
| `PRICING_SOURCE`      | Pricing source            | `coingecko`                                                                                                                                                                                                                                                           |
| `COINGECKO_API_KEY`   | Coingecko API key         | `CG-9B9jasdasdasd`                                                                                                                                                                                                                                                    |
| `COINGECKO_API_TYPE`  | Coingecko API type        | `pro`                                                                                                                                                                                                                                                                 |

## Usage

First, install dependencies:

```bash
pnpm install
```

### Running the Scripts

To run the metadata bootstrap script:

```bash
pnpm bootstrap:metadata --schema=public
```

To run the pricing bootstrap script:

```bash
pnpm bootstrap:pricing --schema=public
```

### To run metadata script for a specific chain

To run the metadata script for a specific chain, you need to modify the `.env` file to include the `CHAIN_IDS` for the specific chain you want to configure. Ensure that the `CHAIN_IDS` environment variable is set with the appropriate chain IDs.

Example `.env` configuration for a specific chain:

```env
CHAIN_IDS=[1]
```

```bash
pnpm bootstrap:metadata --schema=public
```

### Development

```bash
# Run type checking
pnpm check-types

# Run linting
pnpm lint

# Run tests
pnpm test

# Format code
pnpm format:fix
```

## Troubleshooting

### Common Issues

1. **Connection Error**

    - Check if PostgreSQL is running.
    - Verify `DATABASE_URL` is correct.
    - Ensure the database exists.
