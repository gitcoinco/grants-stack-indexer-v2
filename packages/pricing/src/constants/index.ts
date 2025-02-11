// This is the minimum granularity we can get data with on Enterprise plans of Coingecko
// Refer to https://support.coingecko.com/hc/en-us/articles/4538747001881-What-granularity-do-you-support-for-historical-data
export const MIN_GRANULARITY_MS = 3600_000; // 1 hour

// When fetching close prices, we fetch PROXIMITY_FACTOR times the granularity, if granularity is 1 hour, we fetch 5 hours and get the closest price
export const PROXIMITY_FACTOR = 5;
