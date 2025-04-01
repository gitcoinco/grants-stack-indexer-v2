import { encodeAbiParameters, getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IMetadataProvider } from "@grants-stack-indexer/metadata";
import type {
    Bytes32String,
    ChainId,
    DeepPartial,
    ILogger,
    ProcessorEvent,
    TimestampMs,
} from "@grants-stack-indexer/shared";
import { mergeDeep } from "@grants-stack-indexer/shared";

import { OnAttestedHandler } from "../../../src/processors/gitcoinAttestationNetwork/handlers/onAttested.handler.js";
import { AttestationMetadata } from "../../../src/processors/gitcoinAttestationNetwork/types/index.js";

// Function to create a mock event with optional overrides
function createMockEvent(
    overrides: DeepPartial<ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested">> = {},
): ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested"> {
    const defaultEvent: ProcessorEvent<"GitcoinAttestationNetwork", "OnAttested"> = {
        blockNumber: 116385567,
        blockTimestamp: 1708369911 as TimestampMs,
        chainId: 10 as ChainId,
        contractName: "GitcoinAttestationNetwork",
        eventName: "OnAttested",
        logIndex: 221,
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        params: {
            uid: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Bytes32String,
            fee: "1000000000000000",
            recipient: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Bytes32String,
            data: "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000192433c5a6a00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000003b6261666b726569656e7876363769623634696d6e3671676a6a6779796c747779373377677161327875747a6972796e746663753576706f7a3734610000000000",
        },
        transactionFields: {
            hash: "0xd2352acdcd59e312370831ea927d51a1917654697a72434cd905a60897a5bb8b",
            transactionIndex: 6,
            from: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
        },
    };

    return mergeDeep(defaultEvent, overrides) as ProcessorEvent<
        "GitcoinAttestationNetwork",
        "OnAttested"
    >;
}

describe("OnAttestedHandler", () => {
    let mockMetadataProvider: IMetadataProvider;
    let mockLogger: ILogger;
    const mockChainId = 10 as ChainId;

    beforeEach(() => {
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        };
        mockLogger = {
            debug: vi.fn(),
            verbose: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("handles an OnAttested event with metadata", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const expectedDecodedData = {
            projectsContributed: 1n,
            roundsCountributed: 1n,
            chainIdsContributed: 1n,
            totalUSDAmount: 10n,
            timestamp: 1727704881770n,
            metadataCid: "bafkreienxv67ib64imn6qgjjgyyltwy73wgqa2xutziryntfcu5vpoz74a",
        };

        const mockMetadata: AttestationMetadata[] = [
            {
                chainId: mockChainId,
                txnHash: "0x3e12de5018a441e56e460556f3583fa47eeabc4d547f2733457516dacd045186",
                projects: [
                    {
                        id: "0x492ddc16a5d9b2cc00c1c00dc9274ba8d389a7d02c18833e3ac5277a5e9e2452",
                        title: "testerprofile",
                        anchor: "0x27b4037e0cc824519d2a61c3c103637d5a345226",
                        applicationId: "0",
                        applicationCId:
                            "bafkreiemxldojvpj2aqcxa7gn2yz5jkomwwgyyszodldspjfnlksoaebky",
                        payoutAddress: "0x3f15B8c6F9939879Cb030D6dd935348E57109637",
                        roundId: 99,
                        strategy: "allov2.DonationVotingMerkleDistributionDirectTransferStrategy",
                        amountInUSD: 34271085n,
                        amount: 1000000000000000n,
                        token: "USD",
                    },
                ],
            },
        ];

        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockMetadata);

        // Create handler
        const handler = new OnAttestedHandler(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        // Act
        const result = await handler.handle();

        // Assert
        expect(mockMetadataProvider.getMetadata).toHaveBeenCalledWith(
            expectedDecodedData.metadataCid,
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            type: "InsertAttestation",
            args: {
                attestationData: {
                    uid: mockEvent.params.uid,
                    chainId: mockChainId,
                    recipient: getAddress(mockEvent.params.recipient),
                    fee: BigInt(mockEvent.params.fee),
                    refUID: mockEvent.params.refUID,
                    projectsContributed: expectedDecodedData.projectsContributed,
                    roundsContributed: expectedDecodedData.roundsCountributed,
                    chainIdsContributed: expectedDecodedData.chainIdsContributed,
                    totalUSDAmount: expectedDecodedData.totalUSDAmount,
                    timestamp: new Date(1727704881770),
                    metadataCid: expectedDecodedData.metadataCid,
                    metadata: mockMetadata,
                },
                transactionsData: [
                    {
                        chainId: mockMetadata[0]?.chainId,
                        txnHash: mockMetadata[0]?.txnHash,
                    },
                ],
            },
        });
    });

    it("handles an OnAttested event with no metadata", async () => {
        // Encode the data using viem's encodeAbiParameters
        const encodedData = encodeAbiParameters(
            [
                { name: "projectsContributed", type: "uint64" },
                { name: "roundsCountributed", type: "uint64" },
                { name: "chainIdsContributed", type: "uint64" },
                { name: "totalUSDAmount", type: "uint128" },
                { name: "timestamp", type: "uint64" },
                { name: "metadataCid", type: "string" },
            ],
            [1n, 1n, 1n, 10n, 1727704881n, ""],
        );
        // Arrange
        const mockEvent = createMockEvent({
            params: {
                data: encodedData,
            },
        });

        // Mock dependencies
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);

        // Create handler
        const handler = new OnAttestedHandler(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });
        const result = await handler.handle();

        expect(mockMetadataProvider.getMetadata).toHaveBeenCalledWith("");
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            type: "InsertAttestation",
            args: {
                attestationData: {
                    uid: mockEvent.params.uid,
                    chainId: mockChainId,
                    recipient: getAddress(mockEvent.params.recipient),
                    fee: BigInt(mockEvent.params.fee),
                    refUID: mockEvent.params.refUID,
                    projectsContributed: 1n,
                    roundsContributed: 1n,
                    chainIdsContributed: 1n,
                    totalUSDAmount: 10n,
                    timestamp: new Date(1727704881000),
                    metadataCid: "",
                    metadata: [],
                },
                transactionsData: [],
            },
        });
    });

    it("throws an error if the data is not a valid attested data", async () => {
        const mockEvent = createMockEvent({
            params: {
                data: "0x",
            },
        });

        const handler = new OnAttestedHandler(mockEvent, mockChainId, {
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow();
    });
});
