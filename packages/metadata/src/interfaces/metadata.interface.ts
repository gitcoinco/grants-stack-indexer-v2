import z from "zod";

/**
 * Metadata provider interface
 */
export interface IMetadataProvider {
    /**
     * Get metadata from IPFS
     * @param ipfsCid - IPFS CID
     * @returns - Metadata
     * @throws - InvalidCidException if the CID is invalid
     * @throws - InvalidContentException if the retrieved content is invalid
     */
    getMetadata<T>(ipfsCid: string, validateContent?: z.ZodSchema<T>): Promise<T | undefined>;
}

export interface ICacheableMetadataProvider extends IMetadataProvider {
    /**
     * Clear all cached metadata entries.
     * This is only implemented by providers that support caching.
     * @throws If there is an error clearing the cache
     */
    clearCache?(): Promise<void>;
}
