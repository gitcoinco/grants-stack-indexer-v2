import { getAddress } from "viem";

import type { Changeset, Round } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository" | "logger">;

/**
 * Handles the RoleRevoked event for the Allo protocol.
 *
 * This handler performs the following core actions when a new role is revoked:
 * - Delete the round role if the role revoked is admin or manager.
 * - Return the changeset.
 */
export class RoleRevokedHandler implements IEventHandler<"Allo", "RoleRevoked"> {
    constructor(
        readonly event: ProcessorEvent<"Allo", "RoleRevoked">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {
        this.dependencies.logger?.debug("Initializing RoleRevokedHandler", {
            className: "RoleRevokedHandler",
            chainId: this.chainId,
            role: this.event.params.role,
            account: this.event.params.account,
            blockNumber: this.event.blockNumber,
        });
    }
    /* @inheritdoc */
    async handle(): Promise<Changeset[]> {
        const role = this.event.params.role.toLowerCase();
        const account = getAddress(this.event.params.account);
        const { roundRepository, logger } = this.dependencies;

        logger?.debug("Starting role revocation handling", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            account,
            blockNumber: this.event.blockNumber,
        });

        let round: Round | undefined = undefined;

        logger?.debug("Searching for round with admin role", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            account,
        });

        round = await roundRepository.getRoundByRole(this.chainId, "admin", role);

        if (round) {
            logger?.info("Found round with matching admin role, deleting role", {
                className: "RoleRevokedHandler",
                methodName: "handle",
                roundId: round.id,
                role,
                account,
            });

            return [
                {
                    type: "DeleteAllRoundRolesByRoleAndAddress",
                    args: {
                        roundRole: {
                            chainId: this.chainId,
                            roundId: round.id,
                            role: "admin",
                            address: account,
                        },
                    },
                },
            ];
        }

        logger?.debug("Searching for round with manager role", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            account,
        });

        round = await roundRepository.getRoundByRole(this.chainId, "manager", role);

        if (round) {
            logger?.info("Found round with matching manager role, deleting role", {
                className: "RoleRevokedHandler",
                methodName: "handle",
                roundId: round.id,
                role,
                account,
            });

            return [
                {
                    type: "DeleteAllRoundRolesByRoleAndAddress",
                    args: {
                        roundRole: {
                            chainId: this.chainId,
                            roundId: round.id,
                            role: "manager",
                            address: account,
                        },
                    },
                },
            ];
        }

        logger?.warn("No matching round found for role revocation", {
            className: "RoleRevokedHandler",
            methodName: "handle",
            role,
            account,
            chainId: this.chainId,
        });

        return [];
    }
}
