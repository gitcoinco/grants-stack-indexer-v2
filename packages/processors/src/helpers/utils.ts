const UINT64_MAX = 18446744073709551615n;

/**
 * Converts a timestamp to a date
 * @param timestamp - The timestamp to convert to a date
 * @returns The date or null if the timestamp is greater than 18446744073709551615
 */
export const getDateFromTimestamp = (timestamp: bigint): Date | null => {
    return timestamp >= 0n && timestamp < UINT64_MAX
        ? isMilliseconds(timestamp)
            ? new Date(Number(timestamp))
            : new Date(Number(timestamp) * 1000)
        : null;
};

/**
 * Checks if the timestamp is in milliseconds
 * @param timestamp - The timestamp to check
 * @returns True if the timestamp is in milliseconds, false otherwise
 */
export const isMilliseconds = (timestamp: bigint): boolean => {
    return timestamp >= 10_000_000_000n;
};
