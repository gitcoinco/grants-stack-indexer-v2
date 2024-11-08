# @grants-stack-indexer/data-flow

Is a library that provides the core components of the processing pipeline for gitcoin grants-stack-indexer.

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

## Usage

### Importing the Package

You can import the package in your TypeScript or JavaScript files as follows:

```typescript
import { EventsFetcher, Orchestrator, EventsRegistry, EventsFetcher, EventsProcessor } from "@grants-stack-indexer/data-flow";
```

### Example

```typescript
const eventsFetcher = new EventsFetcher(indexerClient);

const chainId = 1;
const blockNumber = 1000;
const logIndex = 0;

const result = await eventsFetcher.fetcEventsByBlockNumberAndLogIndex(
    chainId,
    blockNumber,
    logIndex,
);
```

## API

### [Orchestrator](./src/orchestrator.ts)

The `Orchestrator` class is responsible for orchestrating the processing pipeline for the gitcoin grants-stack-indexer.

### [EventsRegistry](./src/eventsRegistry.ts)

The `EventsRegistry` class is responsible for registering processed events in the processing pipeline.

### [EventsProcessor](./src/eventsProcessor.ts)

The `EventsProcessor` class is responsible for processing events in the processing pipeline.

### [EventsFetcher](./src/eventsFetcher.ts)

The `EventsFetcher` class is responsible for fetching events from the blockchain.

### [StrategyRegistry](./src/strategyRegistry.ts)

The `StrategyRegistry` stores strategy IDs in memory to populate strategy events with them.

### [DataLoader](./src/data-loader/dataLoader.ts)

The `DataLoader` is responsible for applying changesets to the database..
