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
