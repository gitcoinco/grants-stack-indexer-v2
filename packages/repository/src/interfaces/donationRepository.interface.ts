import { NewDonation } from "../internal.js";

export interface IDonationRepository {
    /**
     * Insert a single donation
     * @param donation The donation to insert
     * @returns A promise that resolves when the donation is inserted
     */
    insertDonation(donation: NewDonation): Promise<void>;

    /**
     * Insert many donations
     * @param donations The donations to insert
     * @returns A promise that resolves when the donations are inserted
     */
    insertManyDonations(donations: NewDonation[]): Promise<void>;
}
