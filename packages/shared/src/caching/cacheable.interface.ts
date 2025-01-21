export interface ICacheable {
    /**
     * Clear the cache.
     * @throws If there is an error clearing the cache
     */
    clearCache(): Promise<void>;
}
