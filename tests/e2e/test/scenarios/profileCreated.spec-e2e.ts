import { gql, GraphQLClient } from "graphql-request";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { Bytes32String, IndexerFetchedEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { TestHelper } from "../../src/utils/test-helper.js";
import { PROCESSING_SERVICE_RUNNING_DELAY_MS } from "../globalSetup.js";

describe("Profile Created", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;

    const event: IndexerFetchedEvent<"Registry", "ProfileCreated"> = {
        blockNumber: 19593928,
        blockTimestamp: 1712373191 as TimestampMs,
        chainId: 1,
        contractName: "Registry",
        eventName: "ProfileCreated",
        logIndex: 662,
        params: {
            name: "Project Name",
            nonce: "1370240",
            owner: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            anchor: "0x18Bd9705B3027533B13b0d04046f86eD4Ab8763d",
            metadata: ["1", "bafkreiaf6mnrwictm2qdjbmgfxnniwgx6jvyncqmon7nbmkotpqioewiru"],
            profileId:
                "0x4995998388faa5dd2a09988b82827230c2a36b68f95a8d3172a8098c36fcc767" as Bytes32String,
        },
        srcAddress: "0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: "0xf47c0e1224954086612c4642807d556a86a50c71a1bdfb720a28bee457474fa0",
            transactionIndex: 99,
        },
    };

    /**
     * Setup test environment before all tests
     */
    beforeAll(async () => {
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        // Initialize GraphQL client
        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);

        // Add the event
        await testHelper.addEvents([event]);

        await testHelper.startProcessingService();
        // give some time to fetch the events
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_SERVICE_RUNNING_DELAY_MS));
        await testHelper.stopProcessingService();
    });

    it("creates a project for the ProfileCreated event", async () => {
        const { projects } = await apiGraphQLClient.request<{
            projects: {
                anchorAddress: string;
                chainId: number;
                name: string;
                metadata: object;
                metadataCid: string;
                projectRoles: {
                    address: string;
                    role: string;
                }[];
                registryAddress: string;
                tags: string[];
                projectType: string;
            }[];
        }>(
            gql`
                query ProjectWithRoles($id: String!) {
                    projects(where: { id: { _eq: $id } }) {
                        anchorAddress
                        chainId
                        name
                        metadata
                        metadataCid
                        projectRoles {
                            address
                            role
                        }
                        registryAddress
                        tags
                        projectType
                    }
                }
            `,
            { id: event.params.profileId },
        );

        expect(projects).toHaveLength(1);
        expect(projects[0]).toBeDefined();
        const project = projects[0]!;
        expect(project.name).toBe("Project Name");
        expect(project.anchorAddress).toBe(event.params.anchor);
        expect(project.metadata).toEqual({
            type: "project",
            title: "QuantumStake: Revolutionizing Staking in the Crypto Sphere",
            description:
                "QuantumStake: Revolutionizing Staking in the Crypto Sphere QuantumStake is a cutting-edge staking platform designed to redefine the staking experience for cryptocurrency enthusiasts. Our project boasts several key advantages over competitors, emphasizing innovation, security, and a commitment to addressing contemporary cryptocurrency challenges. Advantages Over Competitors: Advanced Technology Integration: QuantumStake leverages state-of-the-art technologies, including DeFi and NFT integrations, to offer stakers a multifaceted and dynamic experience. Our commitment to staying at the forefront of technological advancements ensures that users have access to the latest features and capabilities. Scalability and Partnerships: We prioritize scalability to accommodate a growing community of stakers. QuantumStake actively seeks strategic partnerships with other projects to expand the staking ecosystem and increase opportunities for our users. User-Friendly Interface: QuantumStake prides itself on a user-friendly interface, making staking accessible to both novices and experienced users. Our intuitive design and comprehensive guides ensure a seamless onboarding process. Community-Driven Development: We prioritize community involvement in decision-making processes. QuantumStake believes in the power of collaboration, and community feedback plays a pivotal role in shaping the evolution of our platform. Security Measures: Smart Contract Audits: QuantumStake undergoes rigorous smart contract audits by reputable third-party security firms. This commitment ensures the integrity and security of our staking protocols, providing users with confidence in the safety of their funds. Decentralized Architecture: Our platform operates on a decentralized architecture, mitigating the risks associated with centralized points of failure. This approach enhances security and resilience against potential attacks. Continuous Monitoring and Updates: QuantumStake employs a dedicated security team to continuously monitor and address potential vulnerabilities. Regular updates and improvements are implemented to enhance the overall security posture of the platform.\n\n",
            website: "https://quantumstakers.com",
            projectTwitter: "QuantumStake",
            logoImg: "bafkreibbxr6hqb7omsmajynrcyarkrvdqapxb7q774la4d2ty2rdqfozxi",
            bannerImg: "bafkreidhwegpoogurhj2rui76vgfp44tju77hqnte6d3d7d3536gltlg7e",
            logoImgData: {},
            bannerImgData: {},
            credentials: {
                twitter: {
                    "@context": ["https://www.w3.org/2018/credentials/v1"],
                    type: ["VerifiableCredential"],
                    credentialSubject: {
                        id: "did:pkh:eip155:1:0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
                        hash: "v0.0.0:QsJcSdNnu5M09heHVeVKhteKFjE0/v/h+1eRkbqpnNc=",
                        provider: "ClearTextTwitter#QuantumStake",
                        "@context": [
                            {
                                hash: "https://schema.org/Text",
                                provider: "https://schema.org/Text",
                            },
                        ],
                    },
                    issuer: "did:key:z6MkghvGHLobLEdj1bgRLhS4LPGJAvbMA1tn2zcRyqmYU5LC",
                    issuanceDate: "2024-04-06T03:12:26.031Z",
                    proof: {
                        type: "Ed25519Signature2018",
                        proofPurpose: "assertionMethod",
                        verificationMethod:
                            "did:key:z6MkghvGHLobLEdj1bgRLhS4LPGJAvbMA1tn2zcRyqmYU5LC#z6MkghvGHLobLEdj1bgRLhS4LPGJAvbMA1tn2zcRyqmYU5LC",
                        created: "2024-04-06T03:12:26.031Z",
                        jws: "eyJhbGciOiJFZERTQSIsImNyaXQiOlsiYjY0Il0sImI2NCI6ZmFsc2V9..YPwPIHIDHaa4vL49XwgnuJ4GZ7XzAmjYfDQxL4ubnfa8lLBD6GkXJGY8IQH7BE7PqsiVlnfJ_fmCbTCVtijhCg",
                    },
                    expirationDate: "2024-07-05T03:12:26.031Z",
                },
            },
            createdAt: 1712373155805,
        });
        expect(project.projectType).toBe("canonical");
        expect(project.tags).toEqual(["allo-v2"]);

        expect(project.projectRoles).toHaveLength(1);
        expect(project.projectRoles[0]).toBeDefined();
        const projectRole = project.projectRoles[0]!;
        expect(projectRole.address).toBe(event.params.owner);
        expect(projectRole.role).toBe("owner");
    });
});
