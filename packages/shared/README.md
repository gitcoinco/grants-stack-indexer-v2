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

### Configuring the Notifier

#### Slack

Visit [Slack API docs](https://api.slack.com/messaging/webhooks) to create a Slack app and configure a webhook URL. You can customize the bot's name, icons and permissions in the app settings.

#### Null

The null notifier is a no-op notifier that does nothing. It is useful when you want to disable notifications.

## To add a new token

To add a new token, you need to modify the `tokens.ts` file in `./src/tokens/tokens.ts`.

Add the token to the `TOKENS` variable.

```typescript
const TOKENS: {
    [chainId: number]: {
        [tokenAddress: Address]: Token;
    };
} = {
    "1": {
        // chainId
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
            // tokenAddress -> this is the address of the token
            code: "USDC" as TokenCode, // tokenCode -> this is the code of the token
            priceSourceCode: "USDC" as TokenCode, // priceSourceCode -> this is the code that will be used to search for the token price
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // tokenAddress -> this is the address of the token
            decimals: 6, // decimals -> this is the number of decimals of the token
        },
    },
};
```

Make sure to update the mapping in coingecko.provider.ts if the priceSourceCode differs from the token code required by CoinGecko.
