export interface PostgresError extends Error {
    code?: string;
    detail?: string;
    constraint?: string;
}
