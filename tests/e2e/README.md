# Grants Stack Indexer: e2e tests

This package contains the end-to-end tests for the Grants Stack Indexer. It provides a complete test environment that simulates all the components of the system using containers and mock services.

## Overview

We use Testcontainers to start the PostgreSQL and Hasura containers and a mock Envio GraphQL API built with Express.

The processing service is directly started through a child process and is configured to connect to the test infrastructure.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Run the tests:

```bash
pnpm test:e2e
```

## Architecture

### Components

-   **TestEnvironment**: Main orchestrator that manages all test components

    -   Sets up and tears down the test infrastructure
    -   Manages network connectivity
    -   Coordinates service startup/shutdown

-   **TestDatabase**: PostgreSQL TestContainer management

    -   Handles database lifecycle
    -   Provides connection strings
    -   Manages container networking

-   **HasuraApiContainer**: Hasura GraphQL Engine TestContainer

    -   Configures Hasura instance
    -   Manages metadata and permissions
    -   Provides GraphQL endpoints

-   **MockEnvioIndexer**: Express server mocking Envio's GraphQL API

    -   Simulates indexer responses
    -   Provides health check endpoint
    -   Manages test event data

-   **ProcessingService**: Manages the actual processing service

    -   Runs in development mode
    -   Uses clean environment variables
    -   Connects to test infrastructure

-   **DatabaseManager**: Handles database setup
    -   Runs migrations
    -   Configures Hasura metadata
    -   Manages schema updates

### References

-   [Vitest](https://vitest.dev/)
-   [Testcontainers](https://testcontainers.com/)
-   [Testcontainers for PostgreSQL](https://testcontainers.com/modules/databases/postgresql/)
