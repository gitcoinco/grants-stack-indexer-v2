import { getAddress } from "viem";

import type { Changeset, Round } from "@grants-stack-indexer/repository";
import type { ChainId, ProcessorEvent } from "@grants-stack-indexer/shared";

import type { IEventHandler, ProcessorDependencies } from "../../../internal.js";

type Dependencies = Pick<ProcessorDependencies, "roundRepository">;

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
    ) {}

    async handle(): Promise<Changeset[]> {
        const role = this.event.params.role.toLowerCase();
        const account = getAddress(this.event.params.account);
        const { roundRepository } = this.dependencies;

        let round: Round | undefined = undefined;

        // search for a round where the admin role is the role granted
        round = await roundRepository.getRoundByRole(this.chainId, "admin", role);
        if (round) {
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

        // search for a round where the manager role is the role granted
        round = await roundRepository.getRoundByRole(this.chainId, "manager", role);
        if (round) {
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
