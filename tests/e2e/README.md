# Grants Stack Indexer: e2e tests

This package contains the end-to-end tests for the Grants Stack Indexer. It provides a complete test environment that simulates all the components of the system using containers and mock services.

## Overview

We use Testcontainers to start the PostgreSQL and Hasura containers and a mock Envio GraphQL API built with Express.
The test environment is set up globally once for all test files, and each test file manages its own processing service instance.
Test files are run sequentially to avoid conflicts between the processing service and the database.

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

### Global Components (Shared Across All Tests)

-   **TestEnvironment**: Main orchestrator for global test infrastructure

    -   Sets up and tears down shared infrastructure (database, Hasura, mock indexer)
    -   Manages network connectivity
    -   Provides connection information through Vitest's inject
    -   Used in `globalSetup.ts` to initialize the test environment

-   **TestDatabase**: PostgreSQL TestContainer management

    -   Handles database lifecycle
    -   Provides connection strings (internal and external)
    -   Manages container networking

-   **HasuraApiContainer**: Hasura GraphQL Engine TestContainer

    -   Configures Hasura instance
    -   Manages metadata and permissions
    -   Provides GraphQL endpoints

-   **MockEnvioIndexer**: Express server mocking Envio's GraphQL API
    -   Simulates indexer responses
    -   Provides health check endpoint
    -   Manages test event data
    -   Exposes REST endpoint for adding events

### Per-Test Components

-   **TestHelper**: Manages test-specific resources and operations

    -   Handles processing service lifecycle for each test
    -   Provides methods for database reset
    -   Offers API for adding test events
    -   Initialized with global state in each test file

-   **ProcessingService**: Manages the actual processing service

    -   Runs in development mode
    -   Uses clean environment variables
    -   Connects to test infrastructure
    -   Created per test file when needed

-   **DatabaseManager**: Handles database operations
    -   Runs migrations
    -   Configures Hasura metadata
    -   Manages schema updates
    -   Provides database reset functionality

## Test Structure

```typescript
describe("e2e scenario", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;

    beforeAll(async () => {
        // Get global state through Vitest's inject
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        // Initialize test helper
        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        // Initialize GraphQL client
        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);
        // Add events to the mock indexer
        await testHelper.addEvents(events);

        await testHelper.startProcessingService();
        // give some time to fetch the events
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await testHelper.stopProcessingService();
    });

    it("test something", async () => {});
});
```

### References

-   [Vitest](https://vitest.dev/)
-   [Testcontainers](https://testcontainers.com/)
-   [Testcontainers for PostgreSQL](https://node.testcontainers.org/modules/postgresql/)
