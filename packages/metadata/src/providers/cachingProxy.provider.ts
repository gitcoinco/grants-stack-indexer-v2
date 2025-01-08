import { z } from "zod";

import { ICache } from "@grants-stack-indexer/repository";
import { ILogger } from "@grants-stack-indexer/shared";

import { IMetadataProvider } from "../internal.js";

/**
 * A metadata provider that caches metadata lookups from the underlying provider.
 * When a metadata is requested, it first checks the cache. If found, returns the cached metadata.
 * If not found in cache, fetches from the underlying provider and caches the result before returning.
 * Cache failures (both reads and writes) are logged but do not prevent the provider from functioning.
 */
export class CachingMetadataProvider implements IMetadataProvider {
    constructor(
        private readonly provider: IMetadataProvider,
        private readonly cache: ICache<string, unknown>,
        private readonly logger: ILogger,
    ) {}

    /** @inheritdoc */
    async getMetadata<T>(
        ipfsCid: string,
        validateContent?: z.ZodSchema<T>,
    ): Promise<T | undefined> {
        let cachedMetadata: T | undefined = undefined;
        try {
            cachedMetadata = (await this.cache.get(ipfsCid)) as T | undefined;
        } catch (error) {
            this.logger.debug(`Failed to get cached metadata for IPFS CID ${ipfsCid}`, {
                error,
            });
        }

        if (cachedMetadata) {
            return cachedMetadata;
        }

        const metadata = await this.provider.getMetadata<T>(ipfsCid, validateContent);

        if (metadata) {
            try {
                await this.cache.set(ipfsCid, metadata);
            } catch (error) {
                this.logger.debug(`Failed to cache metadata for IPFS CID ${ipfsCid}`, {
                    error,
                });
            }
        }

        return metadata;
    }
}
