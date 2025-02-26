import { NewLegacyProject } from "../internal.js";
import { TransactionConnection } from "../types/transaction.types.js";

export interface ILegacyProjectRepository<
    TxConnection extends TransactionConnection = TransactionConnection,
> {
    /**
     * Inserts a new legacy project into the repository.
     * @param legacyProject The new legacy project to insert.
     * @param tx Optional transaction connection
     * @returns A promise that resolves when the insertion is complete.
     */
    insertLegacyProject(legacyProject: NewLegacyProject, tx?: TxConnection): Promise<void>;
}
