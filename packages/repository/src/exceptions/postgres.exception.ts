import { ErrorContext, NonRetriableError, RetriableError } from "@grants-stack-indexer/shared";

import { PostgresError } from "../internal.js";

export class DatabaseException extends NonRetriableError {
    constructor(message: string, context: ErrorContext, error: PostgresError) {
        super(`Database error: ${message}`, context, error);
    }
}

export class DatabaseConnectionException extends NonRetriableError {
    constructor(message: string, context: ErrorContext, error: PostgresError) {
        super(`Database connection error: ${message}`, context, error);
    }
}

export class DatabaseDuplicateKeyException extends NonRetriableError {
    constructor(key: string, value: string, context: ErrorContext, error: PostgresError) {
        super(`Duplicate key violation: ${key}=${value}`, context, error);
    }
}

export class DatabaseConstraintViolationException extends NonRetriableError {
    constructor(constraint: string, message: string, context: ErrorContext, error: PostgresError) {
        super(`Constraint violation (${constraint}): ${message}`, context, error);
    }
}

export class DatabaseInvalidParametersException extends NonRetriableError {
    constructor(message: string, context: ErrorContext, error: PostgresError) {
        super(`Invalid parameters: ${message}`, context, error);
    }
}

export class DatabaseQueryTimeoutException extends RetriableError {
    constructor(message: string, context: ErrorContext, error: PostgresError) {
        super(`Query timeout: ${message}`, context, undefined, error);
    }
}
