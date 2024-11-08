# Grants Stack Indexer v2: Metadata package

This package exposes a metadata provider that can be used to retrieved metadata from IPFS.

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

### Importing the Package

You can import the package in your TypeScript or JavaScript files as follows:

```typescript
import { IpfsProvider } from "@grants-stack-indexer/metadata";
```

### Example

```typescript
const provider = new IpfsProvider(["https://ipfs.io", "https://cloudflare-ipfs.com"]);
const metadata = await provider.getMetadata("QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ");
```

## API

### [IMetadataProvider](./src/interfaces/metadata.interface.ts)

Available methods

-   `getMetadata<T>(ipfsCid: string, validateContent?: z.ZodSchema<T>): Promise<T | undefined>`

## References

-   [IPFS](https://docs.ipfs.tech/reference/http-api/)
