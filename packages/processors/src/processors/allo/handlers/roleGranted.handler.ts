import { getAddress } from "viem";

import type { Changeset, Round } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * Handles the RoleGranted event for the Allo protocol.
 *
 * This handler performs the following core actions when a new role is granted:
 * - Insert a new round role if the role granted is admin or manager.
 * - Insert a new pending round role if the role granted is not admin or manager.
 * - Return the changeset.
 */
export class RoleGrantedHandler implements IEventHandler<"Allo", "RoleGranted"> {
    constructor(
        readonly event: ProcessorEvent<"Allo", "RoleGranted">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing RoleGrantedHandler", {
            className: "RoleGrantedHandler",
            chainId: this.chainId,
            role: this.event.params.role,
            account: this.event.params.account,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const { roundRepository, logger } = this.dependencies;
        const role = this.event.params.role.toLowerCase();
        const account = getAddress(this.event.params.account);

        logger?.debug("Starting role grant handling", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
            blockNumber: this.event.blockNumber,
        });

        let round: Round | undefined = undefined;

        logger?.debug("Searching for round with admin role", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
        });

        round = await roundRepository.getRoundByRole(this.chainId, "admin", role);

        if (round) {
            logger?.info("Found round with matching admin role", {
                className: "RoleGrantedHandler",
                methodName: "handle",
                roundId: round.id,
                role,
                account,
            });

            return [
                {
                    type: "InsertRoundRole",
                    args: {
                        roundRole: {
                            chainId: this.chainId,
                            roundId: round.id,
                            role: "admin",
                            address: account,
                            createdAtBlock: BigInt(this.event.blockNumber),
                        },
                    },
                },
            ];
        }

        logger?.debug("Searching for round with manager role", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
        });

        round = await roundRepository.getRoundByRole(this.chainId, "manager", role);

        if (round) {
            logger?.info("Found round with matching manager role", {
                className: "RoleGrantedHandler",
                methodName: "handle",
                roundId: round.id,
                role,
                account,
            });

            return [
                {
                    type: "InsertRoundRole",
                    args: {
                        roundRole: {
                            chainId: this.chainId,
                            roundId: round.id,
                            role: "manager",
                            address: account,
                            createdAtBlock: BigInt(this.event.blockNumber),
                        },
                    },
                },
            ];
        }

        logger?.info("No matching round found, creating pending role", {
            className: "RoleGrantedHandler",
            methodName: "handle",
            role,
            account,
            chainId: this.chainId,
        });

        return [
            {
                type: "InsertPendingRoundRole",
                args: {
                    pendingRoundRole: {
                        chainId: this.chainId,
                        role: role,
                        address: account,
                        createdAtBlock: BigInt(this.event.blockNumber),
                    },
                },
            },
        ];
    }
}
