# Grants stack indexer `shared` package

The `@grants-stack-indexer/shared` package provides shared utilities, types, constants and logger. This package is designed to be used across the packages of this monorepo to ensure consistency and reusability.

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

### Importing the Package

You can import the package in your TypeScript files as follows:

```typescript
import { ILogger, ProcessorEvent, stringify } from "@grants-stack-indexer/shared";
```
