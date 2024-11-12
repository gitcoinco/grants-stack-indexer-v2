import { getAddress, InvalidAddressError } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
    ALLO_OWNER_ROLE,
    Bytes32String,
    ChainId,
    ProcessorEvent,
} from "@grants-stack-indexer/shared";

import { ProcessorDependencies } from "../../../src/internal.js";
import { RoleGrantedHandler } from "../../../src/processors/registry/handlers/index.js"; // Adjust path if needed

describe("RoleGrantedHandler", () => {
    const mockProjectRepository = {
        getProjectById: vi.fn(),
    };

    const dependencies = {
        projectRepository: mockProjectRepository,
    } as unknown as ProcessorDependencies;

    const chainId = 10 as ChainId; // Example chainId
    const blockNumber = 123456; // Example blockNumber
    const mockedAccount = "0x48f33AE41E1762e1688125C4f1C536B1491dF803";
    const mockedSender = "0xc0969723D577D31aB4bdF7e53C540c11298c56AF";
    const mockedEvent = {
        blockTimestamp: 123123123,
        chainId: 10,
        contractName: "Registry",
        eventName: "RoleGranted",
        params: {
            role: ALLO_OWNER_ROLE,
            account: mockedAccount,
            sender: mockedSender,
        },
        blockNumber,
        logIndex: 10,
        srcAddress: mockedAccount,
        transactionFields: {
            hash: "0x123",
            transactionIndex: 1,
        },
    } as ProcessorEvent<"Registry", "RoleGranted">;

    it("returns an empty array if role is ALLO_OWNER_ROLE", async () => {
        const event = mockedEvent;
        const handler = new RoleGrantedHandler(event, chainId, dependencies);

        const result = await handler.handle();

        expect(result).toEqual([]);
    });

    it("returns InsertProjectRole if project exists", async () => {
        mockedEvent["params"]["role"] = "0x1231231234" as Bytes32String;
        const event = mockedEvent;

        mockProjectRepository.getProjectById.mockResolvedValueOnce({ id: "projectId" });

        const handler = new RoleGrantedHandler(event, chainId, dependencies);

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertProjectRole",
                args: {
                    projectRole: {
                        chainId: chainId,
                        projectId: "projectId",
                        address: getAddress(mockedAccount),
                        role: "member",
                        createdAtBlock: BigInt(blockNumber),
                    },
                },
            },
        ]);
    });

    it("returns InsertPendingProjectRole if project does not exist", async () => {
        mockedEvent["params"]["role"] = "0x1231231234" as Bytes32String;
        const event = mockedEvent;

        mockProjectRepository.getProjectById.mockResolvedValueOnce(undefined);

        const handler = new RoleGrantedHandler(event, chainId, dependencies);

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "InsertPendingProjectRole",
                args: {
                    pendingProjectRole: {
                        chainId: chainId,
                        role: event.params.role.toLowerCase(),
                        address: getAddress(mockedAccount),
                        createdAtBlock: BigInt(blockNumber),
                    },
                },
            },
        ]);
    });

    it("throws an error if getAddress throws an error for an invalid account", async () => {
        mockedEvent["params"]["account"] = "0xinvalid-address"; // Invalid account address
        const event = mockedEvent;

        const handler = new RoleGrantedHandler(event, chainId, dependencies);

        await expect(handler.handle()).rejects.toThrow(InvalidAddressError);
    });

    it("throws an error if projectRepository throws an error", async () => {
        mockedEvent["params"]["role"] = "0x1231231234" as Bytes32String;
        const event = mockedEvent;

        mockProjectRepository.getProjectById.mockRejectedValueOnce(new Error());

        const handler = new RoleGrantedHandler(event, chainId, dependencies);

        await expect(handler.handle()).rejects.toThrow(Error);
    });
});
