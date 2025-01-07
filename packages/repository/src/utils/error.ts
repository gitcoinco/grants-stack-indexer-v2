import { ErrorContext, NonRetriableError, RetriableError } from "@grants-stack-indexer/shared";

import {
    DatabaseConnectionException,
    DatabaseConstraintViolationException,
    DatabaseDuplicateKeyException,
    DatabaseException,
    DatabaseInvalidParametersException,
} from "../exceptions/index.js";
import { PostgresError } from "../internal.js";

/**
 * Handles database errors by mapping them to our custom exception types
 * @param error - The caught database error
 * @returns A standardized DatabaseException
 */
export const handlePostgresError = (
    error: unknown,
    context: ErrorContext,
): RetriableError | NonRetriableError => {
    const pgError = error as PostgresError;

    if (pgError instanceof Error && "code" in pgError) {
        // Connection errors
        if (pgError.code === "57P01" || pgError.code === "57P03") {
            return new DatabaseConnectionException(pgError.message, context, pgError);
        }

        // Duplicate key violations
        if (pgError.code === "23505") {
            const key = pgError.detail?.split("=")[0] || "unknown";
            const value = pgError.detail?.split("=")[1] || "unknown";
            return new DatabaseDuplicateKeyException(key, value, context, pgError);
        }

        // Constraint violations
        if (pgError.code?.startsWith("23")) {
            return new DatabaseConstraintViolationException(
                pgError.constraint || "unknown",
                pgError.message,
                context,
                pgError,
            );
        }

        // Invalid parameters
        if (pgError.code === "22P02" || pgError.code === "22003") {
            return new DatabaseInvalidParametersException(pgError.message, context, pgError);
        }

        // Default database error
        return new DatabaseException(pgError.message, context, pgError);
    }

    // If it's already one of our exceptions, return it as is
    if (error instanceof DatabaseException) {
        return error;
    }

    // Unknown errors
    return new DatabaseException(
        error instanceof Error ? error.message : "An unknown database error occurred",
        context,
        pgError,
    );
};
