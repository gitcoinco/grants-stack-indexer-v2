import { Address, ChainId } from "@grants-stack-indexer/shared";

import { Application, NewApplication, PartialApplication } from "../types/application.types.js";

export interface IApplicationReadRepository {
    /**
     * Retrieves a specific application by its ID, chain ID, and round ID.
     * @param id The ID of the application.
     * @param chainId The chain ID of the application.
     * @param roundId The round ID of the application.
     * @returns A promise that resolves to an Application object if found, or undefined if not found.
     */
    getApplicationById(
        id: string,
        chainId: ChainId,
        roundId: string,
    ): Promise<Application | undefined>;

    /**
     * Retrieves a specific application by its chain ID, round ID, and project ID.
     * @param chainId The chain ID of the application.
     * @param roundId The round ID of the application.
     * @param projectId The project ID of the application.
     * @returns A promise that resolves to an Application object if found, or undefined if not found.
     */
    getApplicationByProjectId(
        chainId: ChainId,
        roundId: string,
        projectId: string,
    ): Promise<Application | undefined>;

    /**
     * Retrieves a specific application by its chain ID, round ID, and anchor address.
     * @param chainId The chain ID of the application.
     * @param roundId The round ID of the application.
     * @param anchorAddress The anchor address of the application.
     * @returns A promise that resolves to an Application object if found, or undefined if not found.
     */
    getApplicationByAnchorAddress(
        chainId: ChainId,
        roundId: string,
        anchorAddress: Address,
    ): Promise<Application | undefined>;

    /**
     * Retrieves a specific application by its chain ID, round ID, and anchor address.
     * @param chainId The chain ID of the application.
     * @param roundId The round ID of the application.
     * @param anchorAddress The anchor address of the application.
     * @returns A promise that resolves to an Application object
     * @throws {ApplicationNotFound} if the application does not exist
     */
    getApplicationByAnchorAddressOrThrow(
        chainId: ChainId,
        roundId: string,
        anchorAddress: Address,
    ): Promise<Application>;

    /**
     * Retrieves all applications for a given chain ID and round ID.
     * @param chainId The chain ID of the applications.
     * @param roundId The round ID of the applications.
     * @returns A promise that resolves to an array of Application objects.
     */
    getApplicationsByRoundId(chainId: ChainId, roundId: string): Promise<Application[]>;
}

export interface IApplicationRepository extends IApplicationReadRepository {
    /**
     * Inserts a new application into the repository.
     * @param application The new application to insert.
     * @returns A promise that resolves when the insertion is complete.
     */
    insertApplication(application: NewApplication): Promise<void>;

    /**
     * Updates an existing application in the repository.
     * @param where An object containing the (id, chainId, and roundId) of the application to update.
     * @param application The partial application data to update.
     * @returns A promise that resolves when the update is complete.
     */
    updateApplication(
        where: { id: string; chainId: ChainId; roundId: string },
        application: PartialApplication,
    ): Promise<void>;
}
