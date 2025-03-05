/**
 * Shared constants for blue-green deployment database operations
 */

// Constant database names
export const BLUE_DB = "GitcoinDatalayerBlue";
export const GREEN_DB = "GitcoinDatalayerGreen";

// These are the only two cache tables we need to handle
export const CACHE_TABLES = ["price_cache", "metadata_cache"];

/**
 * Interface for database connection details
 */
export interface ConnectionDetails {
    host: string;
    port: string;
    user: string;
    password: string;
}

/**
 * Extract connection details from DATABASE_URL
 */
export const extractConnectionDetails = (url: string): ConnectionDetails => {
    // Parse DATABASE_URL (format: postgres://user:password@host:port/dbname)
    // Allow for different protocol variants: postgre, postgres, postgresql
    const connectionRegex = /(?:postgre(?:s|sql)?):\/\/([^:]+):([^@]+)@([^:]+):([^\/]+)\/.*/;
    const match = url.match(connectionRegex);

    if (!match || match.length < 5) {
        throw new Error(`Invalid DATABASE_URL format: ${url}`);
    }

    return {
        user: match[1] as string,
        password: match[2] as string,
        host: match[3] as string,
        port: match[4] as string,
    };
};
