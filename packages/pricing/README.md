# Grants Stack Indexer v2: Pricing package

This package provides different pricing providers that can be used to get
the price of a token at a specific timestamp, using chainId and token address.

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
import { CoingeckoProvider } from "@grants-stack-indexer/pricing";
```

### Example

```typescript
const coingecko = new CoingeckoProvider({
    apiKey: "your-api-key",
    apiType: "demo",
});

const price = await coingecko.getTokenPrice(
    1,
    "0x0d8775f5d29498461708d85e233a7b3331e6f5a0",
    1609459200000,
    1640908800000,
);
```

## API

### [IPricingProvider](./src/interfaces/pricing.interface.ts)

Available methods

-   `getTokenPrice(chainId: number, tokenAddress: Address, startTimestampMs: number, endTimestampMs: number): Promise<TokenPrice | undefined>`

## References

-   [Coingecko API Historical Data](https://docs.coingecko.com/reference/coins-id-market-chart-range)
