import { gql, GraphQLClient } from "graphql-request";
import { Pool } from "pg";
import { beforeAll, describe, expect, expectTypeOf, inject, it } from "vitest";

import { Bytes32String, IndexerFetchedEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { TestHelper } from "../../src/utils/test-helper.js";

/**
 * Happy path events sequence:
 * - ProjectCreated (Registry)
 * - RoleGranted (Allo)
 * - PoolCreated (Allo)
 * - RegisteredWithSender (Strategy)
 *
 * Sad path events sequence:
 * - ProjectCreated (Registry)
 * - PoolCreated (Allo) // Unsupported strategy
 * - RegisteredWithSender (Strategy) // Unsupported strategy event
 */
describe("DVMD Round creation with Pending Role and Application", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;
    let pgPool: Pool;

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

    // The role granted event that will create a pending role
    const roleGrantedEvent: IndexerFetchedEvent<"Allo", "RoleGranted"> = {
        blockNumber: 19593910,
        blockTimestamp: 1712431277 as TimestampMs,
        chainId: 1,
        contractName: "Allo",
        eventName: "RoleGranted",
        logIndex: 661,
        params: {
            role: "0xd866368887d58dbdd097c420fb7ec3bf9a28071e2c715e21155ba472632c67b1" as Bytes32String,
            sender: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            account: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
        },
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xe47c0e1224954086612c4642807d556a86a50c71a1bdfb720a28bee457474fa0",
            transactionIndex: 98,
        },
    };

    const poolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
        blockNumber: 19593914,
        blockTimestamp: 1712373023 as TimestampMs,
        chainId: 1,
        contractName: "Allo",
        eventName: "PoolCreated",
        logIndex: 662,
        params: {
            token: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            amount: "0",
            poolId: "1",
            metadata: ["1", "bafkreiarqej7rdgfx7vsxc4lpqbvcupzx3bd2cvkjenwtn43u4a5dlpj34"],
            strategy: "0x2AcD841b7b7D62a0DbC2a1F8b902eceAb82e85CC",
            profileId: "0x0cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a1f",
        },
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            transactionIndex: 99,
        },
    };

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

    beforeAll(async () => {
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);
        pgPool = new Pool({ connectionString: globalState.databaseUrl });

        // Add events in sequence
        await testHelper.addEvents([
            projectCreatedEvent,
            roleGrantedEvent,
            poolCreatedEvent,
            registeredEvent,
        ]);

        await testHelper.startProcessingService();
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await testHelper.stopProcessingService();
    });

    it("creates a round and converts pending roles to actual roles", async () => {
        // First verify the round was created with proper data
        const { rounds } = await apiGraphQLClient.request<{
            rounds: {
                id: string;
                chainId: number;
                fundedAmount: number;
                strategyAddress: string;
                totalDonationsCount: number;
                matchTokenAddress: string;
                matchAmount: string;
                matchAmountInUsd: string;
                applicationMetadata: object;
                roundMetadata: object;
                applicationsStartTime: Date | null;
                applicationsEndTime: Date | null;
                donationsStartTime: Date | null;
                donationsEndTime: Date | null;
                strategyId: string;
                strategyName: string;
                projectId: string;
                roundRoles: {
                    address: string;
                    role: string;
                }[];
                tags: string[];
            }[];
        }>(
            gql`
                query RoundWithRoles($id: String!) {
                    rounds(where: { id: { _eq: $id } }) {
                        id
                        chainId
                        fundedAmount
                        strategyAddress
                        totalDonationsCount
                        matchTokenAddress
                        matchAmount
                        matchAmountInUsd
                        applicationMetadata
                        roundMetadata
                        applicationsStartTime
                        applicationsEndTime
                        donationsStartTime
                        donationsEndTime
                        strategyId
                        strategyName
                        projectId
                        tags
                        roundRoles {
                            address
                            role
                        }
                    }
                }
            `,
            { id: poolCreatedEvent.params.poolId },
        );

        expect(rounds).toHaveLength(1);
        const round = rounds[0]!;

        // Verify round data
        expect(round.chainId).toBe(1);
        expect(round.fundedAmount).toBe(0);
        expect(round.strategyAddress).toBe(poolCreatedEvent.params.strategy);
        expect(round.tags).toContain("allo-v2");
        expect(round.tags).toContain("grants-stack");
        expect(round.totalDonationsCount).toBe(0);
        expect(round.matchTokenAddress).toBe(poolCreatedEvent.params.token);
        expect(round.applicationMetadata).toEqual({
            lastUpdatedOn: 1712373007752,
            applicationSchema: {
                questions: [
                    {
                        id: 0,
                        title: "Email Address",
                        type: "email",
                        required: false,
                        info: "",
                        choices: [],
                        hidden: true,
                        encrypted: true,
                    },
                    {
                        id: 1,
                        title: "Funding Sources",
                        type: "short-answer",
                        required: false,
                        info: "",
                        choices: [],
                        hidden: false,
                        encrypted: false,
                    },
                    {
                        id: 2,
                        title: "Team Size",
                        type: "number",
                        required: false,
                        info: "",
                        choices: [],
                        hidden: false,
                        encrypted: false,
                    },
                ],
                requirements: {
                    twitter: {
                        required: false,
                        verification: false,
                    },
                    github: {
                        required: false,
                        verification: false,
                    },
                },
            },
            version: "2.0.0",
        });
        expect(round.roundMetadata).toEqual({
            feesPercentage: 0,
            feesAddress: "",
            name: "QuantumStake: Revolutionizing Staking in the Crypto Sphere",
            support: {
                type: "Email",
                info: "quantumstakers@gmail.com",
            },
            roundType: "public",
            quadraticFundingConfig: {
                matchingFundsAvailable: 12000,
                matchingCap: false,
                minDonationThreshold: false,
                sybilDefense: false,
            },
            eligibility: {
                description:
                    "QuantumStake: Revolutionizing Staking in the Crypto Sphere QuantumStake is a cutting-edge staking platform designed to redefine the staking experience for cryptocurrency enthusiasts. Our project boasts several key advantages over competitors, emphasizing innovation, security, and a commitment to addressing contemporary cryptocurrency challenges. Advantages Over Competitors: Advanced Technology Integration: QuantumStake leverages state-of-the-art technologies, including DeFi and NFT integrations, to offer stakers a multifaceted and dynamic experience. Our commitment to staying at the forefront of technological advancements ensures that users have access to the latest features and capabilities. Scalability and Partnerships: We prioritize scalability to accommodate a growing community of stakers. QuantumStake actively seeks strategic partnerships with other projects to expand the staking ecosystem and increase opportunities for our users. User-Friendly Interface: QuantumStake prides itself on a user-friendly interface, making staking accessible to both novices and experienced users. Our intuitive design and comprehensive guides ensure a seamless onboarding process. Community-Driven Development: We prioritize community involvement in decision-making processes. QuantumStake believes in the power of collaboration, and community feedback plays a pivotal role in shaping the evolution of our platform. Security Measures: Smart Contract Audits: QuantumStake undergoes rigorous smart contract audits by reputable third-party security firms. This commitment ensures the integrity and security of our staking protocols, providing users with confidence in the safety of their funds. Decentralized Architecture: Our platform operates on a decentralized architecture, mitigating the risks associated with centralized points of failure. This approach enhances security and resilience against potential attacks. Continuous Monitoring and Updates: QuantumStake employs a dedicated security team to continuously monitor and address potential vulnerabilities. Regular updates and improvements are implemented to enhance the overall security posture of the platform.\n\n",
                requirements: [
                    {
                        requirement: "Tell us about your project",
                    },
                ],
            },
            programContractAddress:
                "0x0cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a1f",
        });
        expect(round.strategyId).toBe(
            "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
        );
        expect(round.strategyName).toBe(
            "allov2.DonationVotingMerkleDistributionDirectTransferStrategy",
        );
        expect(round.projectId).toBe(poolCreatedEvent.params.profileId);
        expect(new Date(round.applicationsStartTime!).getTime()).toBe(1712373600000);
        expect(new Date(round.applicationsEndTime!).getTime()).toBe(1712448000000);
        expect(new Date(round.donationsStartTime!).getTime()).toBe(1712448000000);
        expect(new Date(round.donationsEndTime!).getTime()).toBe(1722470400000);

        // Verify round roles were created properly
        expect(round.roundRoles).toHaveLength(1);
        const role = round.roundRoles[0]!;
        expect(role.address).toBe(roleGrantedEvent.params.account);
        expect(role.role).toBe("admin");
    });

    it("doesnt't have pending roles in the db", async () => {
        const { pendingRoundRoles } = await apiGraphQLClient.request<{
            pendingRoundRoles: { id: string }[];
        }>(gql`
            query PendingRoundRoles {
                pendingRoundRoles {
                    id
                }
            }
        `);

        expectTypeOf(pendingRoundRoles).toEqualTypeOf<{ id: string }[]>();
        expect(pendingRoundRoles).toHaveLength(0);
    });

    it("creates an application when a project registers for the round", async () => {
        const { applications } = await apiGraphQLClient.request<{
            applications: {
                id: string;
                chainId: number;
                projectId: string;
                roundId: string;
                status: string;
                metadataCid: string;
                metadata: object;
                createdByAddress: string;
                createdAtBlock: string;
                statusUpdatedAtBlock: string;
                statusSnapshots: {
                    status: string;
                    updatedAtBlock: string;
                    updatedAt: string;
                }[];
                distributionTransaction: string | null;
                totalAmountDonatedInUsd: string;
                totalDonationsCount: number;
                uniqueDonorsCount: number;
                tags: string[];
                anchorAddress: string;
            }[];
        }>(
            gql`
                query ApplicationDetails($roundId: String!) {
                    applications(where: { roundId: { _eq: $roundId } }) {
                        id
                        chainId
                        projectId
                        roundId
                        status
                        metadataCid
                        metadata
                        createdByAddress
                        createdAtBlock
                        statusUpdatedAtBlock
                        statusSnapshots
                        distributionTransaction
                        totalAmountDonatedInUsd
                        totalDonationsCount
                        uniqueDonorsCount
                        tags
                        anchorAddress
                    }
                }
            `,
            { roundId: poolCreatedEvent.params.poolId },
        );

        expect(applications).toHaveLength(1);
        const application = applications[0]!;

        expect(application.id).toBe("0");
        expect(application.chainId).toBe(1);
        expect(application.projectId).toBe(projectCreatedEvent.params.profileId);
        expect(application.roundId).toBe(poolCreatedEvent.params.poolId);
        expect(application.status).toBe("PENDING");
        expect(application.anchorAddress).toBe(projectCreatedEvent.params.anchor);
        expect(application.createdByAddress).toBe(registeredEvent.params.sender);
        expect(application.createdAtBlock).toBe(registeredEvent.blockNumber);
        expect(application.statusUpdatedAtBlock).toBe(registeredEvent.blockNumber);

        // Verify status snapshots
        expect(application.statusSnapshots).toHaveLength(1);
        const snapshot = application.statusSnapshots[0]!;
        expect(snapshot.status).toBe("PENDING");
        expect(snapshot.updatedAtBlock).toBe(registeredEvent.blockNumber.toString());
        expect(new Date(snapshot.updatedAt).getTime()).toBe(registeredEvent.blockTimestamp * 1000);

        // Verify initial state
        expect(application.distributionTransaction).toBeNull();
        expect(application.totalAmountDonatedInUsd).toBe(0);
        expect(application.totalDonationsCount).toBe(0);
        expect(application.uniqueDonorsCount).toBe(0);
        expect(application.tags).toContain("allo-v2");
    });

    it("verifies the strategy registry contains the strategy with handleable=true", async () => {
        const result = await pgPool.query(
            `SELECT * FROM strategies_registry WHERE chain_id = $1 AND address = $2`,
            [1, poolCreatedEvent.params.strategy],
        );

        expect(result.rows).toHaveLength(1);
        const strategyRecord = result.rows[0] as { id: string; handled: boolean };

        expect(strategyRecord.id).toBe(
            "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0",
        );
        expect(strategyRecord.handled).toBe(true);
    });
});

/**
 * Test cases for unsupported strategies and events
 * These test cases verify the behavior when:
 * 1. A strategy ID doesn't have a handler
 * 2. A strategy event's handler doesn't exist
 */
describe("Unsupported Strategy and Events", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;
    let pgPool: Pool;

    // Common project for both test scenarios
    const projectCreatedEvent: IndexerFetchedEvent<"Registry", "ProfileCreated"> = {
        blockNumber: 19593900,
        blockTimestamp: 1712373000 as TimestampMs,
        chainId: 1,
        contractName: "Registry",
        eventName: "ProfileCreated",
        logIndex: 660,
        params: {
            name: "Test Project",
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

    // Unsupported strategy with a made-up strategyId
    const unsupportedPoolCreatedEvent: IndexerFetchedEvent<"Allo", "PoolCreated"> = {
        blockNumber: 19593914,
        blockTimestamp: 1712373023 as TimestampMs,
        chainId: 1,
        contractName: "Allo",
        eventName: "PoolCreated",
        logIndex: 662,
        params: {
            token: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            amount: "0",
            poolId: "999",
            metadata: ["1", "bafkreiarqej7rdgfx7vsxc4lpqbvcupzx3bd2cvkjenwtn43u4a5dlpj34"],
            strategy: "0xAAAa841B7b7D62a0dBC2a1f8B902eCEaB82e85cC", // Different address
            profileId: "0x0cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a1f",
        },
        srcAddress: "0x1133eA7Af70876e64665ecD07C0A0476d09465a1",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            transactionIndex: 99,
        },
    };

    // Event from an unsupported strategy
    const unsupportedStrategyEvent: IndexerFetchedEvent<"Strategy", "RegisteredWithSender"> = {
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
        srcAddress: "0xAAAa841B7b7D62a0dBC2a1f8B902eCEaB82e85cC", // Same as unsupported strategy
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            transactionIndex: 99,
        },
    };
    const unknownStrategyId = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    beforeAll(async () => {
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);
        pgPool = new Pool({ connectionString: globalState.databaseUrl });

        // Manually insert the strategy with handled=true to simulate a cached strategy
        // This will be updated to handled=false when the system processes the event
        await pgPool.query(
            `INSERT INTO strategies_registry (chain_id, address, id, handled) 
             VALUES ($1, $2, $3, $4)`,
            [
                1,
                unsupportedPoolCreatedEvent.params.strategy,
                unknownStrategyId, // Made-up strategy ID
                true, // Initially set to true
            ],
        );

        // Add events in sequence
        await testHelper.addEvents([
            projectCreatedEvent,
            unsupportedPoolCreatedEvent,
            unsupportedStrategyEvent,
        ]);

        await testHelper.startProcessingService();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await testHelper.stopProcessingService();
    });

    it("updates the strategy registry to mark the strategy as unhandled", async () => {
        const result = await pgPool.query(
            `SELECT * FROM strategies_registry WHERE chain_id = $1 AND address = $2`,
            [1, unsupportedPoolCreatedEvent.params.strategy],
        );

        expect(result.rows).toHaveLength(1);
        const strategyRecord = result.rows[0] as { id: string; handled: boolean };

        // Verify that the system updated the handled flag from true to false
        expect(strategyRecord.handled).toBe(false);
    });

    it("round is created for the unsupported strategy", async () => {
        const { rounds } = await apiGraphQLClient.request<{
            rounds: { id: string; strategyAddress: string; strategyId: string }[];
        }>(
            gql`
                query RoundCheck($id: String!) {
                    rounds(where: { id: { _eq: $id } }) {
                        id
                        strategyAddress
                        strategyId
                    }
                }
            `,
            { id: unsupportedPoolCreatedEvent.params.poolId },
        );

        expect(rounds).toHaveLength(1);
        expect(rounds[0]!.strategyAddress).toBe(unsupportedPoolCreatedEvent.params.strategy);
        expect(rounds[0]!.strategyId).toBe(unknownStrategyId);
    });

    it("doesn't process events from unsupported strategies", async () => {
        // Check if any applications were created from the unsupported strategy event
        const { applications } = await apiGraphQLClient.request<{
            applications: { id: string }[];
        }>(
            gql`
                query ApplicationCheck($anchorAddress: String!) {
                    applications(where: { anchorAddress: { _eq: $anchorAddress } }) {
                        id
                    }
                }
            `,
            { anchorAddress: unsupportedStrategyEvent.params.recipientId },
        );

        // No applications should be created from events of unsupported strategies
        expect(applications).toHaveLength(0);
    });
});
