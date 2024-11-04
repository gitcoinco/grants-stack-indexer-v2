import { optimism } from "viem/chains";

import { EvmProvider } from "@grants-stack-indexer/chain-providers";
import {
    CoreDependencies,
    InMemoryEventsRegistry,
    InMemoryStrategyRegistry,
} from "@grants-stack-indexer/data-flow";
import { EnvioIndexerClient } from "@grants-stack-indexer/indexer-client";
import { IpfsProvider } from "@grants-stack-indexer/metadata";
import { CoingeckoProvider } from "@grants-stack-indexer/pricing";
import {
    createKyselyDatabase,
    KyselyApplicationRepository,
    KyselyProjectRepository,
    KyselyRoundRepository,
} from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { Environment } from "../config/index.js";

export type Dependencies = {
    core: CoreDependencies;
    registries: {
        eventsRegistry: InMemoryEventsRegistry;
        strategyRegistry: InMemoryStrategyRegistry;
    };
    indexerClient: EnvioIndexerClient;
};

export class DependenciesService {
    static initialize(env: Environment, logger: ILogger): Dependencies {
        // Initialize EVM provider
        const evmProvider = new EvmProvider(env.RPC_URLS, optimism, logger);

        // Initialize repositories
        const kyselyDatabase = createKyselyDatabase({
            connectionString: env.DATABASE_URL,
        });

        const projectRepository = new KyselyProjectRepository(kyselyDatabase, env.DATABASE_SCHEMA);
        const roundRepository = new KyselyRoundRepository(kyselyDatabase, env.DATABASE_SCHEMA);
        const applicationRepository = new KyselyApplicationRepository(
            kyselyDatabase,
            env.DATABASE_SCHEMA,
        );
        const pricingProvider = new CoingeckoProvider({
            apiKey: env.COINGECKO_API_KEY,
            apiType: env.COINGECKO_API_TYPE,
        });

        const metadataProvider = new IpfsProvider(env.IPFS_GATEWAYS_URL);

        // Initialize registries
        const eventsRegistry = new InMemoryEventsRegistry();
        const strategyRegistry = new InMemoryStrategyRegistry();

        // Initialize indexer client
        const indexerClient = new EnvioIndexerClient(
            env.INDEXER_GRAPHQL_URL,
            env.INDEXER_ADMIN_SECRET,
        );

        return {
            core: {
                evmProvider,
                projectRepository,
                roundRepository,
                applicationRepository,
                pricingProvider,
                metadataProvider,
            },
            registries: {
                eventsRegistry,
                strategyRegistry,
            },
            indexerClient,
        };
    }
}
