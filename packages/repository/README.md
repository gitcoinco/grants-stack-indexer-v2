# grants-stack-indexer: repository package

This package provides a data access layer for the grants-stack-indexer project, implementing the Repository pattern to abstract database operations.

## Setup

1. Install dependencies by running `pnpm install` in the root directory of the project.

## Available Scripts

Available scripts that can be run using `pnpm`:

| Script        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `build`       | Build library using tsc                                 |
| `check-types` | Check for type issues using tsc                         |
| `clean`       | Remove `dist` folder                                    |
| `lint`        | Run ESLint to check for coding standards                |
| `lint:fix`    | Run linter and automatically fix code formatting issues |
| `format`      | Check code formatting and style using Prettier          |
| `format:fix`  | Run formatter and automatically fix issues              |
| `test`        | Run tests using Vitest                                  |
| `test:cov`    | Run tests with coverage report                          |

## 📋 Prerequisites

-   Ensure you have `node >= 20.0.0` and `pnpm >= 9.5.0` installed.

## Installation

```bash
$ pnpm install
```

## Building

To build the monorepo packages, run:

```bash
$ pnpm build
```

## Test

```bash
# unit tests
$ pnpm run test

# test coverage
$ pnpm run test:cov
```

## Usage

This package provides repository interfaces and implementations for projects and rounds. It uses Kysely as the query builder library.

### Creating a database connection

```typescript
import { createKyselyPostgresDb, DatabaseConfig } from "@grants-stack-indexer/repository";

const dbConfig: DatabaseConfig = {
    connectionString: "postgresql://user:password@localhost:5432/mydb",
};

const db = createKyselyPostgresDb(dbConfig);

// Instantiate a repository
const projectRepository = new KyselyProjectRepository(db, "mySchema");

const projects = await projectRepository.getProjects(10);
```

## API

### Repositories

This package provides the following repositories:

1. **IProjectRepository**: Manages project-related database operations, including project roles and pending roles.

2. **IRoundRepository**: Manages round-related database operations, including round roles and pending roles.

3. **IApplicationRepository**: Manages application-related database operations.

## References

-   [Kysely](https://kysely.dev/)
-   [PostgreSQL](https://www.postgresql.org/)
