import { TransactionConnection } from "../internal.js";

/**
 * The ITransactionManager interface provides a generic transaction management solution using a callback pattern.
 *
 * The generic type parameter TxConnection extends TransactionConnection to allow for different transaction
 * connection implementations while maintaining type safety.
 */
export interface ITransactionManager<
    TxConnection extends TransactionConnection = TransactionConnection,
> {
    /*
     * Provides a transaction connection to the given function.
     * If the function throws an error, the transaction will be rolled back.
     * If the function returns a promise, the transaction will be committed after the promise is resolved.
     *
     * Note: only DB calls that use the provided transaction connection will be executed in the transaction.
     */
    runInTransaction<T>(fn: (tx: TxConnection) => Promise<T>): Promise<T>;
}
