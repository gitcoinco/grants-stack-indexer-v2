import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";

import { Changeset } from "@grants-stack-indexer/repository";
import { Bytes32String, ChainId, ProcessorEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { ProfileNameUpdatedHandler } from "../../../src/processors/registry/handlers/profileNameUpdated.handler.js";

describe("ProfileNameUpdatedHandler", () => {
    const mockEvent: ProcessorEvent<"Registry", "ProfileNameUpdated"> = {
        contractName: "Registry",
        eventName: "ProfileNameUpdated",
        params: {
            profileId: "0xprofile1" as Bytes32String,
            name: "New Profile Name",
            anchor: "0x5aD1D85Bb68791Cb3cE598f56E00F5D5694FAd14",
        },
        blockNumber: 1,
        blockTimestamp: 1 as TimestampMs,
        chainId: 1 as ChainId,
        logIndex: 1,
        srcAddress: "0x0",
        transactionFields: {
            hash: "0x0",
            transactionIndex: 1,
        },
    };

    it("returns a changeset with updated project name and anchor address", async () => {
        const handler = new ProfileNameUpdatedHandler(mockEvent, 1 as ChainId, {
            logger: {
                debug: vi.fn(),
                verbose: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
            },
        });

        const result = await handler.handle();

        const expectedChangeset: Changeset[] = [
            {
                type: "UpdateProject",
                args: {
                    chainId: mockEvent.chainId as ChainId,
                    projectId: mockEvent.params.profileId,
                    project: {
                        name: mockEvent.params.name,
                        anchorAddress: getAddress(mockEvent.params.anchor),
                    },
                },
            },
        ];

        expect(result).toEqual(expectedChangeset);
    });
});
