import { NewApplicationPayout } from "../types/applicationPayout.types.js";

export interface IApplicationPayoutRepository {
    /**
     * Inserts a new application payout into the database.
     * @param applicationPayout - The new application payout to insert.
     * @returns A promise that resolves when the application payout is inserted.
     */
    insertApplicationPayout(applicationPayout: NewApplicationPayout): Promise<void>;
}
