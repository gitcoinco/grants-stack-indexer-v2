import { Kysely } from "kysely";

import { Address, ChainId, stringify } from "@grants-stack-indexer/shared";

import {
    Database,
    handlePostgresError,
    IRoundRepository,
    KyselyTransaction,
    NewPendingRoundRole,
    NewRound,
    NewRoundRole,
    PartialRound,
    PendingRoundRole,
    Round,
    RoundNotFound,
    RoundNotFoundForId,
    RoundRole,
    RoundRoleNames,
} from "../../internal.js";

export class KyselyRoundRepository implements IRoundRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    // ============================ ROUNDS ============================

    /* @inheritdoc */
    async getRounds(chainId: ChainId): Promise<Round[]> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("rounds")
            .where("chainId", "=", chainId)
            .selectAll()
            .execute();
    }

    /* @inheritdoc */
    async getRoundById(chainId: ChainId, roundId: string): Promise<Round | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("rounds")
            .where("chainId", "=", chainId)
            .where("id", "=", roundId)
            .selectAll()
            .executeTakeFirst();
    }

    /* @inheritdoc */
    async getRoundByIdOrThrow(chainId: ChainId, roundId: string): Promise<Round> {
        const round = await this.getRoundById(chainId, roundId);

        if (!round) {
            throw new RoundNotFoundForId(chainId, roundId);
        }
        return round;
    }

    /* @inheritdoc */
    async getRoundByStrategyAddress(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Round | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("rounds")
            .where("chainId", "=", chainId)
            .where("strategyAddress", "=", strategyAddress)
            .selectAll()
            .executeTakeFirst();
    }

    /* @inheritdoc */
    async getRoundByStrategyAddressOrThrow(
        chainId: ChainId,
        strategyAddress: Address,
    ): Promise<Round> {
        const round = await this.getRoundByStrategyAddress(chainId, strategyAddress);
        if (!round) {
            throw new RoundNotFound(chainId, strategyAddress);
        }
        return round;
    }

    /* @inheritdoc */
    async getRoundByRole(
        chainId: ChainId,
        roleName: RoundRoleNames,
        roleValue: string,
    ): Promise<Round | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("rounds")
            .where("chainId", "=", chainId)
            .where(`${roleName}Role`, "=", roleValue)
            .selectAll()
            .executeTakeFirst();
    }

    /* @inheritdoc */
    async getRoundMatchTokenAddressById(
        chainId: ChainId,
        roundId: Address | string,
    ): Promise<Address | undefined> {
        const res = await this.db
            .withSchema(this.schemaName)
            .selectFrom("rounds")
            .where("chainId", "=", chainId)
            .where("id", "=", roundId)
            .select("matchTokenAddress")
            .executeTakeFirst();

        return res?.matchTokenAddress;
    }

    /* @inheritdoc */
    async insertRound(round: NewRound, tx?: KyselyTransaction): Promise<void> {
        const _round = this.formatRound(round);
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.insertInto("rounds").values(_round).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "insertRound",
                additionalData: {
                    round: _round,
                },
            });
        }
    }

    /* @inheritdoc */
    async updateRound(
        where: { id: string; chainId: ChainId } | { chainId: ChainId; strategyAddress: Address },
        round: PartialRound,
        tx?: KyselyTransaction,
    ): Promise<void> {
        const _round = this.formatRound(round);
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            const query = queryBuilder
                .updateTable("rounds")
                .set(_round)
                .where("chainId", "=", where.chainId);

            if ("id" in where) {
                await query.where("id", "=", where.id).execute();
            } else {
                await query.where("strategyAddress", "=", where.strategyAddress).execute();
            }
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "updateRound",
                additionalData: {
                    where,
                    round: _round,
                },
            });
        }
    }

    /* @inheritdoc */
    async incrementRoundFunds(
        where: { chainId: ChainId; roundId: string },
        amount: bigint,
        amountInUsd: string,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .updateTable("rounds")
                .set((eb) => ({
                    fundedAmount: eb("fundedAmount", "+", amount),
                    fundedAmountInUsd: eb("fundedAmountInUsd", "+", amountInUsd),
                }))
                .where("chainId", "=", where.chainId)
                .where("id", "=", where.roundId)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "incrementRoundFunds",
                additionalData: {
                    where,
                    amount,
                    amountInUsd,
                },
            });
        }
    }

    /* @inheritdoc */
    async incrementRoundTotalDistributed(
        where: { chainId: ChainId; roundId: string },
        amount: bigint,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .updateTable("rounds")
                .set((eb) => ({
                    totalDistributed: eb("totalDistributed", "+", amount),
                }))
                .where("chainId", "=", where.chainId)
                .where("id", "=", where.roundId)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "incrementRoundTotalDistributed",
                additionalData: {
                    where,
                    amount,
                },
            });
        }
    }

    // ============================ ROUND ROLES ============================

    /* @inheritdoc */
    async getRoundRoles(): Promise<RoundRole[]> {
        return this.db.withSchema(this.schemaName).selectFrom("roundRoles").selectAll().execute();
    }

    /* @inheritdoc */
    async insertRoundRole(roundRole: NewRoundRole, tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.insertInto("roundRoles").values(roundRole).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "insertRoundRole",
                additionalData: {
                    roundRole,
                },
            });
        }
    }

    /* @inheritdoc */
    async deleteManyRoundRolesByRoleAndAddress(
        chainId: ChainId,
        roundId: string,
        role: RoundRoleNames,
        address: Address,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .deleteFrom("roundRoles")
                .where("chainId", "=", chainId)
                .where("roundId", "=", roundId)
                .where("role", "=", role)
                .where("address", "=", address)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "deleteManyRoundRolesByRoleAndAddress",
                additionalData: {
                    chainId,
                    roundId,
                    role,
                    address,
                },
            });
        }
    }

    // ============================ PENDING ROUND ROLES ============================

    /* @inheritdoc */
    async getPendingRoundRoles(
        chainId: ChainId,
        role: RoundRoleNames,
    ): Promise<PendingRoundRole[]> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("pendingRoundRoles")
            .where("chainId", "=", chainId)
            .where("role", "=", role)
            .selectAll()
            .execute();
    }

    /* @inheritdoc */
    async insertPendingRoundRole(
        pendingRoundRole: NewPendingRoundRole,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.insertInto("pendingRoundRoles").values(pendingRoundRole).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "insertPendingRoundRole",
                additionalData: {
                    pendingRoundRole,
                },
            });
        }
    }

    /* @inheritdoc */
    async deleteManyPendingRoundRoles(ids: number[], tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.deleteFrom("pendingRoundRoles").where("id", "in", ids).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyRoundRepository.name,
                methodName: "deleteManyPendingRoundRoles",
                additionalData: {
                    ids,
                },
            });
        }
    }

    /**
     * Formats the round to ensure that the matchingDistribution is stored as a JSONB string.
     * @param round - The round to format.
     * @returns The formatted round.
     */
    private formatRound<T extends NewRound | PartialRound>(round: T): T {
        if (round?.matchingDistribution) {
            round = {
                ...round,
                matchingDistribution: stringify(round.matchingDistribution),
            };
        }
        return round;
    }
}
