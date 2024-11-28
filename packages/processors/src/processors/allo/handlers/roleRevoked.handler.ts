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
    ) {}

    async handle(): Promise<Changeset[]> {
        const role = this.event.params.role.toLowerCase();
        const account = getAddress(this.event.params.account);
        const { roundRepository, logger } = this.dependencies;
        let round: Round | undefined = undefined;

        // search for a round where the admin role is the role granted
        round = await roundRepository.getRoundByRole(this.chainId, "admin", role);
        if (round) {
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

        // search for a round where the manager role is the role granted
        round = await roundRepository.getRoundByRole(this.chainId, "manager", role);
        if (round) {
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

        logger.warn(`No round found for role ${role} on chain ${this.chainId}`);
        return [];
    }
}
