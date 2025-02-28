# Hasura Configuration Scripts

This directory contains scripts to configure Hasura metadata, including:

-   Tracking tables
-   Setting up relationships between tables
-   Configuring public permissions
-   Tracking custom functions

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables in the root `.env` file:

```env
HASURA_ENDPOINT=http://localhost:8082  # Your Hasura endpoint
HASURA_ADMIN_SECRET=secret             # Your Hasura admin secret
HASURA_SCHEMA=public                   # Your database schema
```

## Usage

Run the configuration script:

```bash
pnpm api:configure
```

This will:

1. Clear existing metadata
2. Track all tables in the database
3. Create relationships between tables
4. Track custom functions
5. Set up public permissions for SELECT operations with a limit of 50 rows

## Tables Configured

The script will configure the following tables:

-   projects
-   pending_project_roles
-   project_roles
-   rounds
-   pending_round_roles
-   round_roles
-   applications
-   applications_payouts
-   donations
-   legacy_projects

## Relationships

The script sets up the following relationships:

### Array Relationships (One-to-Many)

#### Projects

-   Has many applications
-   Has many projectRoles
-   Has many rounds

#### Rounds

-   Has many applications
-   Has many roundRoles

#### Applications

-   Has many applicationsPayouts

### Object Relationships (Many-to-One)

#### Project Roles

-   Belongs to project

#### Rounds

-   Belongs to project

#### Round Roles

-   Belongs to round

#### Applications

-   Belongs to project
-   Belongs to round

#### Applications Payouts

-   Belongs to application

## Virtual Relationships

In addition to standard relationships based on foreign key constraints, this project uses virtual relationships (manual configurations) for certain tables where database-level foreign key constraints cannot be enforced due to external requirements.

### Why Virtual Relationships?

Virtual relationships allow us to define GraphQL relationships in Hasura without requiring actual foreign key constraints in the database. This is useful in several scenarios:

1. **External Requirements**: When database-level constraints cannot be enforced due to external system requirements or limitations
2. **Views**: When relating to or from database views (which don't support foreign keys)

### Virtual Relationships in this Project

#### Attestation Transactions to Donations

-   **Relationship Type**: Object relationship (One-To-Many)
-   **From Table**: `attestation_txns`
-   **To Table**: `donations`
-   **Mapping**: `txnHash` → `transactionHash`, `chainId` → `chainId`
-   **Purpose**: Links attestation transactions to their corresponding donations
-   **Why Virtual**: Foreign key constraints cannot be enforced at the database level because donations and attestations can happen in different chains. This would require that donation's chain is always processed before attestation's chain but chains are processed in parallel thus this is not guaranteed

### Querying Virtual Relationships

Virtual relationships can be queried exactly like regular relationships in GraphQL. For example:

```graphql
query {
    attestationTxns {
        txnHash
        chainId
        donation {
            id
            donorAddress
            amount
        }
    }
}
```

### Comparison to PostGraphile Smart Tags

This approach is conceptually similar to PostGraphile's Smart Tags/Comments system, where you can use PostgreSQL comments to define virtual relationships:

```sql
  comment on table ${ref("attestation_txns")} is
  E'@foreignKey ("txn_hash", "chain_id") references ${ref(
    "donations"
  )}(transaction_hash, chain_id)|@fieldName donations';
```

The key differences:

-   **Implementation**: Hasura uses metadata API calls rather than database comments
-   **Management**: Hasura relationships are managed through the console or API, while PostGraphile uses database-level comments

Both approaches achieve the same goal: defining GraphQL relationships that may not exist at the database level.

## Custom Functions

The script tracks the following custom functions:

-   search_projects

## Development

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
