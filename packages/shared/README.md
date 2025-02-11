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
