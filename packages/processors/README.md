# Grants stack indexer v2 `processors` package

The `processors` package provides a set of utilities for processing and transforming data within the grants stack indexer project. It includes processors for handling Allo, Strategy, and Registry events.

## Setup

1. Install dependencies running `pnpm install`

## Available Scripts

Available scripts that can be run using `pnpm`:

| Script        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `build`       | Build library using tsc                                 |
| `check-types` | Check types issues using tsc                            |
| `clean`       | Remove `dist` folder                                    |
| `lint`        | Run ESLint to check for coding standards                |
| `lint:fix`    | Run linter and automatically fix code formatting issues |
| `format`      | Check code formatting and style using Prettier          |
| `format:fix`  | Run formatter and automatically fix issues              |
| `test`        | Run tests using vitest                                  |
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

```typescript
import { AlloProcessor } from "@grants-stack-indexer/processors";

const alloProcessor = new AlloProcessor(chainId, dependencies);
const changeset = await this.alloProcessor.process(event);
```

## API

### Processors

This package provides the following events' processors:

1. **AlloProcessor**: Handles the processing of Allo V2 events from the Allo contract by delegating them to the appropriate handler

2. **RegistryProcessor**: Handles the processing of Allo V2 events from the Registry contract by delegating them to the appropriate handler

3. **StrategyProcessor**: Handles the processing of Allo V2 events from the Strategy contract by delegating them to the appropriate handler

## References

-   [Allo Protocol](https://github.com/allo-protocol/allo-v2)
