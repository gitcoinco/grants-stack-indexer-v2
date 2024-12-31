import type { Changeset } from "@grants-stack-indexer/repository";

export interface IDataLoader {
    /**
     * Applies the changesets to the database.
     * @param changesets - The changesets to apply.
     * @returns The execution result.
     * @throws {InvalidChangeset} if there are changesets with invalid types.
     */
    applyChanges(changesets: Changeset[]): Promise<void>;
}
