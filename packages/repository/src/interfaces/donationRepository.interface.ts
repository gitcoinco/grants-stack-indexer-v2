import { NewDonation } from "../internal.js";
import { TransactionConnection } from "../types/transaction.types.js";

export interface IDonationRepository<
    TxConnection extends TransactionConnection = TransactionConnection,
> {
    /**
     * Insert a single donation
     * @param donation The donation to insert
     * @param tx Optional transaction connection
     * @returns A promise that resolves when the donation is inserted
     */
    insertDonation(donation: NewDonation, tx?: TxConnection): Promise<void>;

    /**
     * Insert many donations
     * @param donations The donations to insert
     * @param tx Optional transaction connection
     * @returns A promise that resolves when the donations are inserted
     */
    insertManyDonations(donations: NewDonation[], tx?: TxConnection): Promise<void>;
}
