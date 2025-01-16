import { ICache } from "../../internal.js";

/**
 * A cache for metadata using a simple in-memory map.
 * This cache is used to store and retrieve metadata
 */
export class InMemoryMetadataCache implements ICache<string> {
    private readonly cache: Map<string, unknown> = new Map();

    /** @inheritdoc */
    async get<T>(id: string): Promise<T | undefined> {
        return this.cache.get(id) as T | undefined;
    }

    /** @inheritdoc */
    async set<T>(id: string, metadata: T): Promise<void> {
        this.cache.set(id, metadata);
    }

    /** @inheritdoc */
    async clearAll(): Promise<void> {
        this.cache.clear();
    }
}
