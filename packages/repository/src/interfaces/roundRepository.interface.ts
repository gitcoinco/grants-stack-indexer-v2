import { Address, ChainId } from "@grants-stack-indexer/shared";

import {
    NewPendingRoundRole,
    NewRound,
    NewRoundRole,
    PartialRound,
    PendingRoundRole,
    Round,
    RoundRole,
    RoundRoleNames,
} from "../types/round.types.js";

export interface IRoundReadRepository {
    /**
     * Retrieves all rounds for a given chain ID.
     * @param chainId The chain ID to fetch rounds for.
     * @returns A promise that resolves to an array of Round objects.
     */
    getRounds(chainId: ChainId): Promise<Round[]>;

    /**
     * Retrieves a specific round by its ID and chain ID.
     * @param chainId The chain ID of the round.
     * @param roundId The ID of the round to fetch.
     * @returns A promise that resolves to a Round object if found, or undefined if not found.
     */
    getRoundById(chainId: ChainId, roundId: string): Promise<Round | undefined>;

    /**
     * Retrieves a round by its strategy address and chain ID.
     * @param chainId The chain ID of the round.
     * @param strategyAddress The strategy address of the round.
     * @returns A promise that resolves to a Round object if found, or undefined if not found.
     */
    getRoundByStrategyAddress(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Round | undefined>;

    /**
     * Retrieves a round by its strategy address and chain ID.
     * @param chainId The chain ID of the round.
     * @param strategyAddress The strategy address of the round.
     * @returns A promise that resolves to a Round object
     * @throws {RoundNotFound} if the round does not exist
     */
    getRoundByStrategyAddressOrThrow(chainId: ChainId, strategyAddress: Address): Promise<Round>;

    /**
     * Retrieves a round by a specific role and role value.
     * @param chainId The chain ID of the round.
     * @param roleName The name of the role to filter by.
     * @param roleValue The value of the role to filter by.
     * @returns A promise that resolves to a Round object if found, or undefined if not found.
     */
    getRoundByRole(
        chainId: ChainId,
        roleName: RoundRoleNames,
        roleValue: string,
    ): Promise<Round | undefined>;

    /**
     * Retrieves the match token address for a specific round.
     * @param chainId The chain ID of the round.
     * @param roundId The ID of the round.
     * @returns A promise that resolves to the match token address if found, or undefined if not found.
     */
    getRoundMatchTokenAddressById(
        chainId: ChainId,
        roundId: Address | string,
    ): Promise<Address | undefined>;

    /**
     * Retrieves all round roles.
     * @returns A promise that resolves to an array of RoundRole objects.
     */
    getRoundRoles(): Promise<RoundRole[]>;

    /**
     * Retrieves pending round roles for a specific chain and role.
     * @param chainId The chain ID to fetch pending roles for.
     * @param role The specific role to fetch pending roles for.
     * @returns A promise that resolves to an array of PendingRoundRole objects.
     */
    getPendingRoundRoles(chainId: ChainId, role: RoundRoleNames): Promise<PendingRoundRole[]>;
}

export interface IRoundRepository extends IRoundReadRepository {
    /**
     * Inserts a new round into the repository.
     * @param round The new round to insert.
     * @returns A promise that resolves when the insertion is complete.
     */
    insertRound(round: NewRound): Promise<void>;

    /**
     * Updates an existing round in the repository.
     * @param where An object containing the id and chainId of the round to update.
     * @param round The partial round data to update.
     * @returns A promise that resolves when the update is complete.
     */
    updateRound(
        where: { id: string; chainId: ChainId } | { chainId: ChainId; strategyAddress: Address },
        round: PartialRound,
    ): Promise<void>;

    /**
     * Increments the funds for a specific round.
     * @param where An object containing the chainId and roundId of the round to update.
     * @param amount The amount to increment by.
     * @param amountInUsd The amount in USD to increment by.
     * @returns A promise that resolves when the increment is complete.
     */
    incrementRoundFunds(
        where: {
            chainId: ChainId;
            roundId: string;
        },
        amount: bigint,
        amountInUsd: string,
    ): Promise<void>;

    /**
     * Increments the total distributed amount for a specific round.
     * @param where An object containing the chainId and roundId of the round to update.
     * @param amount The amount to increment by.
     * @returns A promise that resolves when the increment is complete.
     */
    incrementRoundTotalDistributed(
        where: {
            chainId: ChainId;
            roundId: string;
        },
        amount: bigint,
    ): Promise<void>;

    /**
     * Inserts a new round role into the repository.
     * @param roundRole The new round role to insert.
     * @returns A promise that resolves when the insertion is complete.
     */
    insertRoundRole(roundRole: NewRoundRole): Promise<void>;

    /**
     * Deletes multiple round roles based on chain ID, round ID, role, and address.
     * @param chainId The chain ID of the roles to delete.
     * @param roundId The round ID of the roles to delete.
     * @param role The role name of the roles to delete.
     * @param address The address associated with the roles to delete.
     * @returns A promise that resolves when the deletion is complete.
     */
    deleteManyRoundRolesByRoleAndAddress(
        chainId: ChainId,
        roundId: string,
        role: RoundRoleNames,
        address: Address,
    ): Promise<void>;

    /**
     * Inserts a new pending round role into the repository.
     * @param pendingRoundRole The new pending round role to insert.
     * @returns A promise that resolves when the insertion is complete.
     */
    insertPendingRoundRole(pendingRoundRole: NewPendingRoundRole): Promise<void>;

    /**
     * Deletes multiple pending round roles by their IDs.
     * @param ids An array of IDs of the pending round roles to delete.
     * @returns A promise that resolves when the deletion is complete.
     */
    deleteManyPendingRoundRoles(ids: number[]): Promise<void>;
}
