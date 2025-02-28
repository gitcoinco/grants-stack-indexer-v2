import { gql, GraphQLClient } from "graphql-request";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { Bytes32String, IndexerFetchedEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { TestHelper } from "../../src/utils/test-helper.js";

/**
 * This test suite covers allocation event types:
 * 1. AllocatedWithOrigin - Used by DonationVotingMerkleDistributionDirectTransfer strategy
 * 2. AllocatedWithToken - Used by DirectGrantsLite strategy
 * 3. DirectAllocated - Used by DirectAllocation strategy
 *
 * Each test case requires the following setup:
 * - Project creation (ProfileCreated)
 * - Round creation (PoolCreated)
 * - Application registration (RegisteredWithSender) - except for DirectAllocated
 * - Allocation event
 */
describe("Allocation Events", () => {
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

    // DVMD Strategy Events
    describe("Allocation Events", () => {
        const dvmdPoolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
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

        const dvmdRegisteredEvent: IndexerFetchedEvent<"Strategy", "RegisteredWithSender"> = {
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

        const dvmdAllocatedEvents: IndexerFetchedEvent<"Strategy", "AllocatedWithOrigin">[] = [
            {
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
                    hash: "0x3dc870fa3b69b8fe21daea2bce46c4597d9505461648d51af5d1fee3c630b096",
                    transactionIndex: 112,
                },
            },
            {
                blockNumber: 19700493,
                blockTimestamp: 1712374000 as TimestampMs,
                chainId: 1,
                contractName: "Strategy",
                eventName: "AllocatedWithOrigin",
                logIndex: 664,
                params: {
                    token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                    amount: "4000000000000000",
                    origin: "0xE2Bf5877d3a88EEeB1D037a172ddf60dc99e07e2",
                    sender: "0x3bA9DF642f5e895DC76d3Aa9e4CE8291108E65b1",
                    recipientId: projectCreatedEvent.params.anchor,
                },
                srcAddress: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
                transactionFields: {
                    from: "0xE2Bf5877d3a88EEeB1D037a172ddf60dc99e07e2",
                    hash: "0x10c797b5777168e431f1ee8e91dfcf1da6fab013fce04984b5069a6a9217b271",
                    transactionIndex: 91,
                },
            },
        ];

        const dglPoolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
            blockNumber: 20033650,
            blockTimestamp: 1717687343 as TimestampMs,
            chainId: 1,
            contractName: "Allo",
            eventName: "PoolCreated",
            logIndex: 662,
            params: {
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                amount: "0",
                poolId: "5",
                metadata: ["1", "bafkreihkuv3mfwhmgjx2hstnf5o3luyv7mtz4e5u74ml6qmfjltf2oudc4"],
                strategy: "0x1dFE1579689a2A98A2053374356D5C81a01C4655",
                profileId: projectCreatedEvent.params.profileId,
            },
            srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
            transactionFields: {
                from: "0xDEEB789dBF635c056F1FCe8681cFdd96a789B9be",
                hash: "0x67086117018ca358686f2edac1b26060c96f66395e45f1aaccffc10cfa0def3a",
                transactionIndex: 74,
            },
        };

        const dglRegisteredEvent: IndexerFetchedEvent<"Strategy", "RegisteredWithSender"> = {
            blockNumber: 20033651,
            blockTimestamp: 1717687344 as TimestampMs,
            chainId: 1,
            contractName: "Strategy",
            eventName: "RegisteredWithSender",
            logIndex: 663,
            params: {
                data: "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000010000000000000000000000000018bd9705b3027533b13b0d04046f86ed4ab8763d000000000000000000000000f3002e97f5ba36bd219c5cb41e6104cff114e351000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b726569673474646e6771657472377a376f776a777870676868376175777667797669756c64737069346a676e746a7176656466336a76340000000000",
                sender: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
                recipientId: "0x83cA32f18436653A0d49fae0f977EE43983e51b1",
            },
            srcAddress: "0x1dFE1579689a2A98A2053374356D5C81a01C4655",
            transactionFields: {
                from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
                hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
                transactionIndex: 99,
            },
        };

        const dglAllocatedEvent: IndexerFetchedEvent<"Strategy", "AllocatedWithToken"> = {
            blockNumber: 20033652,
            blockTimestamp: 1717687345 as TimestampMs,
            chainId: 1,
            contractName: "Strategy",
            eventName: "AllocatedWithToken",
            logIndex: 664,
            params: {
                recipientId: "0x83cA32f18436653A0d49fae0f977EE43983e51b1",
                amount: "10000000", // 0.01 ETH (with 6 decimals for test)
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token (ETH)
                sender: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351", // Round admin
            },
            srcAddress: "0x1dFE1579689a2A98A2053374356D5C81a01C4655",
            transactionFields: {
                from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
                hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                transactionIndex: 100,
            },
        };

        // DirectAllocation Strategy Events
        const daPoolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
            blockNumber: 20382670,
            blockTimestamp: 1721899727 as TimestampMs,
            chainId: 1,
            contractName: "Allo",
            eventName: "PoolCreated",
            logIndex: 665,
            params: {
                token: "0x0000000000000000000000000000000000000000",
                amount: "0",
                poolId: "11",
                metadata: ["0", ""],
                strategy: "0xef78F18F49dEa8B8a5CAA41633BB50b0666D40F1",
                profileId: projectCreatedEvent.params.profileId,
            },
            srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
            transactionFields: {
                from: "0x8C180840fcBb90CE8464B4eCd12ab0f840c6647C",
                hash: "0x5aca8a20d39d99f01780ce7b22b89022e7e86ecf4e5242ae88506ede26b022a4",
                transactionIndex: 84,
            },
        };

        const daDirectAllocatedEvent: IndexerFetchedEvent<"Strategy", "DirectAllocated"> = {
            blockNumber: 20033662,
            blockTimestamp: 1717687352 as TimestampMs,
            chainId: 1,
            contractName: "Strategy",
            eventName: "DirectAllocated",
            logIndex: 666,
            params: {
                token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                amount: "360000000000000",
                sender: "0xCC3Dd0894E6A5852d6A91Bbd173528f124A129bE",
                profileId: projectCreatedEvent.params.profileId,
                profileOwner: projectCreatedEvent.params.owner,
            },
            srcAddress: "0xef78F18F49dEa8B8a5CAA41633BB50b0666D40F1",
            transactionFields: {
                from: "0xCC3Dd0894E6A5852d6A91Bbd173528f124A129bE",
                hash: "0xb175ea11ae72257345cba0fb0b7eb6805dde45c09f65106b0296391d39a1d6f7",
                transactionIndex: 180,
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
                dvmdPoolCreatedEvent,
                dvmdRegisteredEvent,
                ...dvmdAllocatedEvents,
                dglPoolCreatedEvent,
                dglRegisteredEvent,
                dglAllocatedEvent,
                daPoolCreatedEvent,
                daDirectAllocatedEvent,
            ]);

            await testHelper.startProcessingService();
            await new Promise((resolve) => setTimeout(resolve, 4000));
            await testHelper.stopProcessingService();
        });

        it("creates donations records", async () => {
            const { donations } = await apiGraphQLClient.request<{
                donations: {
                    id: string;
                    chainId: number;
                    rounds: {
                        id: string;
                    };
                    applications: {
                        id: string;
                    };
                    donorAddress: string;
                    recipientAddress: string;
                    projectId: string;
                    tokenAddress: string;
                    amount: string;
                    amountInUsd: string;
                    amountInRoundMatchToken: string;
                    timestamp: string;
                }[];
            }>(
                gql`
                    query DonationDetails(
                        $chainId: Int!
                        $roundId: String!
                        $applicationId: String!
                    ) {
                        donations(
                            where: {
                                chainId: { _eq: $chainId }
                                roundId: { _eq: $roundId }
                                applicationId: { _eq: $applicationId }
                            }
                        ) {
                            id
                            chainId
                            rounds {
                                id
                            }
                            applications {
                                id
                            }
                            donorAddress
                            recipientAddress
                            projectId
                            tokenAddress
                            amount
                            amountInUsd
                            amountInRoundMatchToken
                            timestamp
                        }
                    }
                `,
                {
                    chainId: 1,
                    roundId: "1",
                    applicationId: "0",
                },
            );

            expect(donations).toHaveLength(2);
            const donation = donations[0]!;

            expect(donation.chainId).toBe(1);
            expect(donation.rounds.id).toBe(dvmdPoolCreatedEvent.params.poolId);
            expect(donation.applications.id).toBe("0");
            expect(donation.donorAddress).toBe(dvmdAllocatedEvents[0]!.params.origin);
            expect(donation.recipientAddress).toBe("0xf3002e97f5ba36BD219C5CB41e6104CFf114e351");
            expect(donation.projectId).toBe(projectCreatedEvent.params.profileId);
            expect(donation.tokenAddress.toString()).toBe(
                dvmdAllocatedEvents[0]!.params.token.toString(),
            );
            expect(donation.amount.toString()).toBe(
                dvmdAllocatedEvents[0]!.params.amount.toString(),
            );
        });

        it("creates an application payout record", async () => {
            const { applicationsPayouts } = await apiGraphQLClient.request<{
                applicationsPayouts: {
                    id: string;
                    chainId: number;
                    applicationId: string;
                    roundId: string;
                    amount: string;
                    tokenAddress: string;
                    amountInUsd: string;
                    amountInRoundMatchToken: string;
                    transactionHash: string;
                    timestamp: Date;
                    sender: string;
                }[];
            }>(
                gql`
                    query ApplicationPayoutDetails($roundId: String!) {
                        applicationsPayouts(where: { roundId: { _eq: $roundId } }) {
                            id
                            chainId
                            applicationId
                            roundId
                            amount
                            tokenAddress
                            amountInUsd
                            amountInRoundMatchToken
                            transactionHash
                            timestamp
                            sender
                        }
                    }
                `,
                { roundId: dglPoolCreatedEvent.params.poolId },
            );

            expect(applicationsPayouts).toHaveLength(1);
            const payout = applicationsPayouts[0]!;

            expect(payout.chainId).toBe(1);
            expect(payout.roundId).toBe(dglPoolCreatedEvent.params.poolId);
            expect(payout.applicationId).toBe("0"); // From the RegisteredWithSender event
            expect(payout.amount.toString()).toBe(dglAllocatedEvent.params.amount.toString());
            expect(payout.amountInRoundMatchToken.toString()).toBe(
                dglAllocatedEvent.params.amount.toString(),
            );
            expect(payout.tokenAddress).toBe(dglAllocatedEvent.params.token);
            expect(payout.transactionHash).toBe(dglAllocatedEvent.transactionFields.hash);
            expect(payout.sender).toBe(dglAllocatedEvent.params.sender);
            expect(new Date(payout.timestamp).getTime()).toBe(
                dglAllocatedEvent.blockTimestamp * 1000,
            );
        });

        it("creates a donation record from a direct allocation", async () => {
            const { donations } = await apiGraphQLClient.request<{
                donations: {
                    id: string;
                    chainId: number;
                    roundId: string;
                    applicationId: string | null;
                    donorAddress: string;
                    recipientAddress: string;
                    projectId: string;
                    transactionHash: string;
                    blockNumber: string;
                    tokenAddress: string;
                    amount: string;
                    amountInUsd: string;
                    amountInRoundMatchToken: string;
                    timestamp: string;
                }[];
            }>(
                gql`
                    query DirectAllocationDonations($roundId: String!) {
                        donations(
                            where: { roundId: { _eq: $roundId }, applicationId: { _isNull: true } }
                        ) {
                            id
                            chainId
                            roundId
                            applicationId
                            donorAddress
                            recipientAddress
                            projectId
                            transactionHash
                            blockNumber
                            tokenAddress
                            amount
                            amountInUsd
                            amountInRoundMatchToken
                            timestamp
                        }
                    }
                `,
                { roundId: daPoolCreatedEvent.params.poolId },
            );

            expect(donations).toHaveLength(1);
            const donation = donations[0]!;

            // Verify donation data
            expect(donation.chainId).toBe(1);
            expect(donation.roundId).toBe(daPoolCreatedEvent.params.poolId);
            expect(donation.applicationId).toBeNull(); // No application for DirectAllocated
            expect(donation.donorAddress).toBe(daDirectAllocatedEvent.params.sender);
            expect(donation.recipientAddress).toBe(daDirectAllocatedEvent.params.profileOwner);
            expect(donation.projectId).toBe(daDirectAllocatedEvent.params.profileId);
            expect(donation.blockNumber).toBe(daDirectAllocatedEvent.blockNumber);
            expect(donation.tokenAddress).toBe(daDirectAllocatedEvent.params.token);
            expect(donation.amount.toString()).toBe(
                daDirectAllocatedEvent.params.amount.toString(),
            );
        });
    });
});
