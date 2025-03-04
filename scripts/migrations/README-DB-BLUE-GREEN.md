# Blue-Green Database Operations

This utility provides scripts for managing PostgreSQL databases in a blue-green deployment strategy. It handles the creation and maintenance of two fixed databases: **GitcoinDatalayerBlue** and **GitcoinDatalayerGreen**.

## Features

The scripts offer two main operations:

1. **Database Creation** - Create both blue and green databases if they don't exist
2. **Database Copy** - Create an exact copy of all tables and data from one database to the other

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

## Database Copy

Use this operation to create an exact copy of one database to the other. This is essential for maintaining consistency during blue-green deployments.

```bash
# Copy all tables and data from blue to green
pnpm db:copy-cache --copyFrom=blue

# Copy all tables and data from green to blue
pnpm db:copy-cache --copyFrom=green

# Using the shorthand parameter
pnpm db:copy-cache -f blue
```

### How Database Copy Works

1. The script reads the PostgreSQL connection details from the `DATABASE_URL` environment variable
2. It determines the source and target databases based on the `copyFrom` parameter
3. It retrieves a list of all tables in the source database
4. For each table:
    - It truncates the target table (removing all existing data)
    - Copies all data from the source table to the target table
    - Processes data in batches to avoid memory issues with large tables
5. After completion, the target database is an exact copy of the source database

## Blue-Green Deployment Process

Here's a typical workflow for using this utility in a blue-green deployment:

```bash
# Step 1: Ensure both databases exist
pnpm db:create-databases

# Step 2: Deploy new version to the inactive environment (e.g., green)
# (Your deployment steps here)

# Step 3: Copy data from the active environment to the inactive one
pnpm db:copy-cache --copyFrom=blue

# Step 4: Switch traffic to the newly updated environment
# (Your traffic switching steps here)
```

This process allows for zero-downtime deployments by maintaining two parallel database environments.
