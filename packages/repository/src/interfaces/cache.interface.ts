/**
 * Interface for a cache.
 * @template Key - The type of the key.
 * @template Value - The type of the value.
 */
export interface ICache<Key, Value = unknown> {
    /**
     * Get the value for a given key.
     * @param key - The key to get the value for.
     * @returns The value for the given key, or undefined if the key is not found.
     * @throws If there is an error getting the value.
     */
    get(key: Key): Promise<Value | undefined>;

    /**
     * Set the value for a given key.
     * @param key - The key to set the value for.
     * @param value - The value to set for the given key.
     * @throws If there is an error setting the value.
     */
    set(key: Key, value: Value): Promise<void>;

    /**
     * Clear all values from the cache.
     * @throws If there is an error clearing the cache.
     */
    clearAll(): Promise<void>;
}
