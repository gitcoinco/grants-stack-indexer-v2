/**
 * Maximum number of retries for bulk fetching metadata.
 */
export const MAX_BULK_FETCH_METADATA_RETRIES = 10;

/**
 * Base delay in milliseconds for bulk fetching metadata retries.
 */
export const METADATA_BULK_FETCH_BASE_DELAY_MS = 1000;

/**
 * Backoff factor for bulk fetching metadata retries.
 */
export const METADATA_BULK_FETCH_BACKOFF_FACTOR = 1.5;

/**
 * Maximum concurrency for bulk fetching metadata.
 */
export const MAX_BULK_FETCH_METADATA_CONCURRENCY = 10;
