import { describe, expect, it, vi } from "vitest";

import { Changeset } from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId, ProcessorEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { ProfileOwnerUpdatedHandler } from "../../../src/processors/registry/handlers/profileOwnerUpdated.handler.js";

describe("ProfileOwnerUpdatedHandler", () => {
    it("handles ProfileOwnerUpdated event correctly", async () => {
        const mockEvent: ProcessorEvent<"Registry", "ProfileOwnerUpdated"> = {
            blockNumber: 123456,
            blockTimestamp: 123456 as TimestampMs,
            chainId: 1 as ChainId,
            contractName: "Registry",
            eventName: "ProfileOwnerUpdated",
            logIndex: 0,
            srcAddress: "0x1234567890123456789012345678901234567890",
            params: {
                profileId: "0xprofile123" as Bytes32String,
                owner: "0x5aD1D85Bb68791Cb3cE598f56E00F5D5694FAd14",
            },
            transactionFields: {
                hash: "0xhash",
                transactionIndex: 0,
            },
        };

        const mockDependencies = {
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
            },
        };

        const handler = new ProfileOwnerUpdatedHandler(
            mockEvent,
            mockEvent.chainId as ChainId,
            mockDependencies,
        );

        const result = await handler.handle();

        const expectedChangeset: Changeset[] = [
            {
                type: "DeleteAllProjectRolesByRole",
                args: {
                    projectRole: {
                        chainId: mockEvent.chainId as ChainId,
                        projectId: mockEvent.params.profileId,
                        role: "owner",
                    },
                },
            },
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: mockEvent.chainId as ChainId,
                        projectId: mockEvent.params.profileId,
                        address: mockEvent.params.owner,
                        role: "owner",
                        createdAtBlock: BigInt(mockEvent.blockNumber),
                    },
                },
            },
        ];

        expect(result).toEqual(expectedChangeset);
    });
});
