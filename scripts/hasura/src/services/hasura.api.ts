import axios, { AxiosError, AxiosInstance, isAxiosError } from "axios";

import type { CustomFunction, HasuraConfig, RelationshipConfig } from "../internal.js";
import { HasuraApiException, NetworkException } from "../internal.js";

/**
 * A class to interact with the Hasura Metadata API for managing database configurations,
 * including tracking tables, setting up relationships, and configuring permissions.
 * Provides methods to programmatically update Hasura's metadata through its HTTP API.
 *
 * refer to: https://hasura.io/docs/2.0/api-reference/metadata-api/index/
 *
 * @template Tables - An array of table names.
 */
export class HasuraMetadataApi<Tables extends readonly string[]> {
    private adminSecret: string;
    private endpoint: string;
    private schema: string;
    private fetchLimit: number;
    private axiosInstance: AxiosInstance;

    constructor(config: HasuraConfig) {
        this.adminSecret = config.adminSecret;
        this.endpoint = config.endpoint;
        this.schema = config.schema;
        this.fetchLimit = config.fetchLimit;
        this.axiosInstance = axios.create({
            baseURL: this.endpoint,
            headers: {
                "Content-Type": "application/json",
                "X-Hasura-Admin-Secret": this.adminSecret,
            },
        });
    }

    /**
     * Clears the metadata in Hasura.
     *
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the metadata clearing fails.
     * @throws {NetworkException} If there is a network error.
     */
    async clearMetadata(): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "clear_metadata",
                args: {},
            });
            console.log("✅ Metadata cleared");
        } catch (err) {
            this.handleError(err, "clear metadata");
        }
    }

    /**
     * Tracks a table in Hasura.
     *
     * @param {Tables[number]} tableName - The name of the table to track.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the table tracking fails.
     * @throws {NetworkException} If there is a network error.
     */
    async trackTable(tableName: Tables[number]): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_track_table",
                args: {
                    source: "default",
                    table: {
                        name: tableName,
                        schema: this.schema,
                    },
                },
            });
            console.log(`✅ Tracked table: ${tableName}`);
        } catch (err) {
            this.handleError(err, `track ${tableName} table`);
        }
    }

    /**
     * Creates an array relationship in Hasura.
     *
     * @param {RelationshipConfig<Tables>} relationship - The relationship configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the array relationship creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async createArrayRelationship(relationship: RelationshipConfig<Tables>): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_array_relationship",
                args: relationship,
            });
            console.log(
                `✅ Created array relationship: ${relationship.name} for ${relationship.table.name}`,
            );
        } catch (err) {
            this.handleError(err, `create array relationship ${relationship.name}`);
        }
    }

    /**
     * Creates an object relationship in Hasura.
     *
     * @param {RelationshipConfig<Tables>} relationship - The relationship configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the object relationship creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async createObjectRelationship(relationship: RelationshipConfig<Tables>): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_object_relationship",
                args: relationship,
            });
            console.log(
                `✅ Created object relationship: ${relationship.name} for ${relationship.table.name}`,
            );
        } catch (err) {
            this.handleError(err, `create object relationship ${relationship.name}`);
        }
    }

    /**
     * Sets a select permission for public role for a table in Hasura.
     *
     * @param {Tables[number]} tableName - The name of the table to set the permission for.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the select permission creation fails.
     * @throws {NetworkException} If there is a network error.
     */
    async setSelectPermission(tableName: Tables[number]): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_create_select_permission",
                args: {
                    table: {
                        name: tableName,
                        schema: this.schema,
                    },
                    source: "default",
                    role: "public",
                    permission: {
                        limit: this.fetchLimit,
                        allow_aggregations: true,
                        columns: "*",
                        filter: {},
                    },
                },
            });
            console.log(`✅ Set select permission for ${tableName}`);
        } catch (err) {
            this.handleError(err, `set select permission for ${tableName}`);
        }
    }

    /**
     * Tracks a custom function in Hasura.
     *
     * @param {CustomFunction} func - The function configuration.
     * @returns {Promise<void>}
     * @throws {HasuraApiException} If the custom function tracking fails.
     * @throws {NetworkException} If there is a network error.
     */
    async trackFunction(func: CustomFunction): Promise<void> {
        try {
            await this.axiosInstance.post("/v1/metadata", {
                type: "pg_track_function",
                args: {
                    function: {
                        name: func.name,
                        schema: func.schema,
                    },
                    source: "default",
                },
            });
            console.log(`✅ Tracked function: ${func.name}`);
        } catch (err) {
            this.handleError(err, `track custom function ${func.name}`);
        }
    }

    /**
     * Handles errors from the Hasura API.
     *
     * @param {unknown} err - The error to handle.
     * @param {string} operation - The operation that failed.
     * @returns {never}
     */
    private handleError(err: unknown, operation: string): never {
        const error = err as Error | AxiosError;
        let errorMessage = `❌ Failed to ${operation}`;

        if (isAxiosError(error)) {
            if (!error.response) {
                // Network error
                throw new NetworkException(`Network error while ${operation}: ${error.message}`);
            }
            if (error.response.status >= 500) {
                // Server error
                throw new HasuraApiException(
                    `Server error while ${operation}: ${error.response.data || error.message}`,
                );
            }
            // Other API errors
            errorMessage += `: ${error.response.data || error.message}`;
        } else {
            errorMessage += `: ${error.message}`;
        }

        throw new HasuraApiException(errorMessage);
    }
}
