# Blue-Green Database Operations

This utility provides scripts for managing PostgreSQL databases in a blue-green deployment strategy. It handles the creation and maintenance of two fixed databases: **GitcoinDatalayerBlue** and **GitcoinDatalayerGreen**.

## Features

The scripts offer two main operations:

1. **Database Creation** - Create both blue and green databases if they don't exist
2. **Cache Data Copy** - Copy external services cache data from one database to the other

## Database Creation

Use this operation to create the required blue and green databases if they don't already exist.

```bash
# Create both databases if they don't exist
pnpm db:create-databases
```

### How Database Creation Works

1. The script reads the PostgreSQL connection details from the `DATABASE_URL` environment variable
2. It checks if the databases `GitcoinDatalayerBlue` and `GitcoinDatalayerGreen` exist
3. If either database doesn't exist, it creates it
4. This operation can be run multiple times without error, as it only creates databases when needed

## Cache Data Copy

Use this operation to copy cache data between blue and green databases. This is essential for maintaining cache consistency during blue-green deployments.

```bash
# Copy cache data from blue to green
pnpm db:copy-cache --copyFrom=blue

# Copy cache data from green to blue
pnpm db:copy-cache --copyFrom=green

# Using the shorthand parameter
pnpm db:copy-cache -f blue
```

### How Cache Data Copy Works

1. The script reads the PostgreSQL connection details from the `DATABASE_URL` environment variable
2. It handles the three specific cache tables: `price_cache`, `metadata_cache` and `strategy_timings`
3. For each table:
    - It truncates the target table
    - Copies all data from the source to the target table
    - Processes data in batches to avoid memory issues with large tables

### Cache Tables

The script only copies the following tables, which contain cached data from external services:

-   `price_cache`: Stores token price information
-   `metadata_cache`: Stores token metadata
-   `strategy_timings`: Stores strategy timings (fetched from contract calls)

All other tables are managed through the regular migration process and are not part of the blue-green deployment cache copying strategy.
