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
