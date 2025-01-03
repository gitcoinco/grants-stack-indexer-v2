import { NewApplicationPayout } from "../types/applicationPayout.types.js";
import { TransactionConnection } from "../types/transaction.types.js";

export interface IApplicationPayoutRepository<
    TxConnection extends TransactionConnection = TransactionConnection,
> {
    /**
     * Inserts a new application payout into the database.
     * @param applicationPayout - The new application payout to insert.
     * @param tx Optional transaction connection
     * @returns A promise that resolves when the application payout is inserted.
     */
    insertApplicationPayout(
        applicationPayout: NewApplicationPayout,
        tx?: TxConnection,
    ): Promise<void>;
}
