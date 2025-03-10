import { gql, GraphQLClient } from "graphql-request";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { Bytes32String, IndexerFetchedEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { TestHelper } from "../../src/utils/test-helper.js";

/**
 * This test suite covers attestation scenarios:
 * 1. Attestation without a corresponding donation (donation should be null in the API)
 * 2. Attestation with a donation from a different chain ID
 *
 * Each test case requires the following setup:
 * - Project creation (ProfileCreated)
 * - Round creation (PoolCreated)
 * - Application registration (RegisteredWithSender)
 * - Donation event (AllocatedWithOrigin) for the second scenario
 * - Attestation event (OnAttested)
 */
describe("Attestation Events", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;

    // Common project for all test scenarios
    const projectCreatedEvent: IndexerFetchedEvent<"Registry", "ProfileCreated"> = {
        blockNumber: 19593900,
        blockTimestamp: 1712373000 as TimestampMs,
        chainId: 1,
        contractName: "Registry",
        eventName: "ProfileCreated",
        logIndex: 660,
        params: {
            name: "Project Name",
            nonce: "1136007",
            owner: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            anchor: "0x83cA32f18436653A0d49fae0f977EE43983e51b1",
            metadata: ["1", "bafkreidl7yst7jpd7ebofslgpdxabn4jsxzhaoc2dwzfnyzh66ll4aqpqm"],
            profileId:
                "0x0cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a1f" as Bytes32String,
        },
        srcAddress: "0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf47c0e1224954086612c4642807d556a86a50c71a1bdfb720a28bee457474fa0",
            transactionIndex: 99,
        },
    };

    // Pool created event for the round
    const poolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
        blockNumber: 19593914,
        blockTimestamp: 1712373023 as TimestampMs,
        chainId: 1,
        contractName: "Allo",
        eventName: "PoolCreated",
        logIndex: 662,
        params: {
            token: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI token
            amount: "0",
            poolId: "1",
            metadata: ["1", "bafkreiarqej7rdgfx7vsxc4lpqbvcupzx3bd2cvkjenwtn43u4a5dlpj34"],
            strategy: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
            profileId: projectCreatedEvent.params.profileId,
        },
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            transactionIndex: 99,
        },
    };

    // Application registration event
    const registeredEvent: IndexerFetchedEvent<"Strategy", "RegisteredWithSender"> = {
        blockNumber: 19593967,
        blockTimestamp: 1712373659 as TimestampMs,
        chainId: 1,
        contractName: "Strategy",
        eventName: "RegisteredWithSender",
        logIndex: 663,
        params: {
            data: "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000010000000000000000000000000018bd9705b3027533b13b0d04046f86ed4ab8763d000000000000000000000000f3002e97f5ba36bd219c5cb41e6104cff114e351000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b726569673474646e6771657472377a376f776a777870676868376175777667797669756c64737069346a676e746a7176656466336a76340000000000",
            sender: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            recipientId: "0x83cA32f18436653A0d49fae0f977EE43983e51b1",
        },
        srcAddress: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            transactionIndex: 99,
        },
    };

    // Donation event on chain 1
    const donationEvent: IndexerFetchedEvent<"Strategy", "AllocatedWithOrigin"> = {
        blockNumber: 19600493,
        blockTimestamp: 1712374000 as TimestampMs,
        chainId: 1,
        contractName: "Strategy",
        eventName: "AllocatedWithOrigin",
        logIndex: 664,
        params: {
            token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            amount: "386896701556813",
            origin: "0x159454539ae10016B4c7c1dD7fDa8A937701F0d1",
            sender: "0x3bA9DF642f5e895DC76d3Aa9e4CE8291108E65b1",
            recipientId: projectCreatedEvent.params.anchor,
        },
        srcAddress: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
        transactionFields: {
            from: "0x159454539ae10016B4c7c1dD7fDa8A937701F0d1",
            hash: "0x3da1cd3462778cb79ebdb71e0d6ba9e61de2366ce2fbc2a097da1e1e2ea42a28",
            transactionIndex: 112,
        },
    };

    // Attestation event without corresponding donation
    const attestationEventWithoutDonation: IndexerFetchedEvent<
        "GitcoinAttestationNetwork",
        "OnAttested"
    > = {
        blockNumber: 19800000,
        blockTimestamp: 1712380000 as TimestampMs,
        chainId: 11155111,
        contractName: "GitcoinAttestationNetwork",
        eventName: "OnAttested",
        logIndex: 666,
        params: {
            uid: "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234" as Bytes32String,
            recipient: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            fee: "1000000000000000",
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Bytes32String,
            data: "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000066faaf3100000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000003b6261666b7265696162656b6e3236786563643665616b6b6671626779726278787768746e3775636a763571716a7733666762726a63366864636c790000000000",
        },
        srcAddress: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            transactionIndex: 120,
        },
    };

    // Attestation event with donation from a different chain
    const attestationEventWithDifferentChainDonation: IndexerFetchedEvent<
        "GitcoinAttestationNetwork",
        "OnAttested"
    > = {
        blockNumber: 19900000,
        blockTimestamp: 1712390000 as TimestampMs,
        chainId: 11155111,
        contractName: "GitcoinAttestationNetwork",
        eventName: "OnAttested",
        logIndex: 667,
        params: {
            uid: "0xefef5678efef5678efef5678efef5678efef5678efef5678efef5678efef5678" as Bytes32String,
            recipient: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            fee: "2000000000000000",
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Bytes32String,
            data: "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000015fe16876084d0000000000000000000000000000000000000000000000000000000066faaf3100000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000003b6261666b726569626e676d3562786b797a6761676c746e65357134726c643736736f377769637032637974697562323734706f636467756c6966650000000000",
        },
        srcAddress: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
        transactionFields: {
            from: "0xf3002e97f5ba36bd219c5cb41e6104cff114e351",
            hash: "0x10c797b5777168e431f1ee8e91dfcf1da6fab013fce04984b5069a6a9217b271", // Same hash as the donation on chain 10
            transactionIndex: 121,
        },
    };

    beforeAll(async () => {
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);

        // Add events in sequence
        await testHelper.addEvents([
            projectCreatedEvent,
            poolCreatedEvent,
            registeredEvent,
            donationEvent,
            attestationEventWithDifferentChainDonation,
            attestationEventWithoutDonation,
        ]);

        const testHelperOtherChain = new TestHelper(globalState);

        await testHelper.startProcessingService();
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await testHelperOtherChain.startProcessingService([
            {
                id: 11155111,
                name: "sepolia",
                rpcUrls: [
                    "https://sepolia.gateway.tenderly.co",
                    "https://eth-sepolia.public.blastapi.io",
                    "https://gateway.tenderly.co/public/sepolia",
                    "https://sepolia.drpc.org",
                ],
                fetchLimit: 30,
                fetchDelayMs: 5000,
            },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 3500));
        await testHelper.stopProcessingService();
        await testHelperOtherChain.stopProcessingService();
    });

    it("creates an attestation record without a linked donation", async () => {
        // Query for the attestation
        const { attestations } = await apiGraphQLClient.request<{
            attestations: {
                uid: string;
                chainId: number;
                recipient: string;
                fee: string;
                refUid: string;
                projectsContributed: string;
                roundsContributed: string;
                chainIdsContributed: string;
                totalUsdamount: string;
                timestamp: string;
                metadataCid: string;
                attestationTxns: {
                    txnHash: string;
                    chainId: number;
                    donation: {
                        id: string;
                    } | null;
                }[];
            }[];
        }>(
            gql`
                query GetAttestation($uid: String!, $chainId: Int!) {
                    attestations(where: { uid: { _eq: $uid }, chainId: { _eq: $chainId } }) {
                        uid
                        chainId
                        recipient
                        fee
                        refUid
                        projectsContributed
                        roundsContributed
                        chainIdsContributed
                        totalUsdamount
                        timestamp
                        metadataCid
                        attestationTxns {
                            txnHash
                            chainId
                            donation {
                                id
                            }
                        }
                    }
                }
            `,
            {
                uid: attestationEventWithoutDonation.params.uid,
                chainId: attestationEventWithoutDonation.chainId,
            },
        );

        // Verify attestation was created
        expect(attestations).toHaveLength(1);
        const attestation = attestations[0]!;

        // Verify attestation data
        expect(attestation.uid).toBe(attestationEventWithoutDonation.params.uid);
        expect(attestation.chainId).toBe(attestationEventWithoutDonation.chainId);
        expect(attestation.recipient).toBe(attestationEventWithoutDonation.params.recipient);
        expect(attestation.fee.toString()).toBe(attestationEventWithoutDonation.params.fee);
        expect(attestation.refUid).toBe(attestationEventWithoutDonation.params.refUID);
        expect(attestation.projectsContributed).toBe(1);
        expect(attestation.roundsContributed).toBe(1);
        expect(attestation.chainIdsContributed).toBe(1);
        expect(attestation.totalUsdamount).toBe(10);

        // Verify attestation transactions
        expect(attestation.attestationTxns).toHaveLength(1);
        const txn = attestation.attestationTxns[0]!;
        expect(txn.chainId).toBe(1);
        expect(txn.txnHash).toBe(
            "0xf6f7ae3cfc9816413b367f7ab80caccc250ee4a788d7e6073945993542a88186",
        );

        // Verify no donation is linked
        expect(txn.donation).toBeNull();
    });

    it("creates an attestation record with a donation from a different chain", async () => {
        const { attestations } = await apiGraphQLClient.request<{
            attestations: {
                uid: string;
                chainId: number;
                recipient: string;
                attestationTxns: {
                    txnHash: string;
                    chainId: number;
                    donation: {
                        id: string;
                        chainId: number;
                        transactionHash: string;
                    } | null;
                }[];
            }[];
        }>(
            gql`
                query GetAttestation($uid: String!, $chainId: Int!) {
                    attestations(where: { uid: { _eq: $uid }, chainId: { _eq: $chainId } }) {
                        uid
                        chainId
                        recipient
                        attestationTxns {
                            txnHash
                            chainId
                            donation {
                                id
                                chainId
                                transactionHash
                            }
                        }
                    }
                }
            `,
            {
                uid: attestationEventWithDifferentChainDonation.params.uid,
                chainId: attestationEventWithDifferentChainDonation.chainId,
            },
        );

        // Verify attestation was created
        expect(attestations).toHaveLength(1);
        const attestation = attestations[0]!;

        // Verify attestation data
        expect(attestation.uid).toBe(attestationEventWithDifferentChainDonation.params.uid);
        expect(attestation.chainId).toBe(attestationEventWithDifferentChainDonation.chainId);
        expect(attestation.recipient).toBe(
            attestationEventWithDifferentChainDonation.params.recipient,
        );

        // Verify attestation transactions
        expect(attestation.attestationTxns).toHaveLength(1);
        const txn = attestation.attestationTxns[0]!;
        expect(txn.txnHash).toBe(donationEvent.transactionFields.hash);
        expect(txn.chainId).toBe(donationEvent.chainId);

        // Verify donation from different chain is linked
        expect(txn.donation).not.toBeNull();
    });
});
