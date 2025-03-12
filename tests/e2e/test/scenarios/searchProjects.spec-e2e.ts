import { gql, GraphQLClient } from "graphql-request";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { Bytes32String, Hex, IndexerFetchedEvent, TimestampMs } from "@grants-stack-indexer/shared";

import { TestHelper } from "../../src/utils/test-helper.js";
import { PROCESSING_SERVICE_RUNNING_DELAY_MS } from "../globalSetup.js";

describe("Search Projects", () => {
    let testHelper: TestHelper;
    let apiGraphQLClient: GraphQLClient;

    // Create multiple projects with different names to test search
    const projects: {
        name: string;
        anchor: Hex;
        profileId: Bytes32String;
    }[] = [
        {
            name: "Quantum Development Fund",
            anchor: "0x4fee09C29A71F491A814D304854907Ea7BAB69F2",
            profileId:
                "0x0cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a1f" as Bytes32String,
        },
        {
            name: "Blockchain Research Initiative",
            anchor: "0xf685e62387Cbde964feBf25E597Cba920D6904Ef",
            profileId:
                "0x1cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a2f" as Bytes32String,
        },
        {
            name: "Quantum Computing Lab",
            anchor: "0x75f1509D97C3C245c075F90BADf7A3F83545b27F",
            profileId:
                "0x2cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a3f" as Bytes32String,
        },
        {
            name: "DeFi Develop Grant",
            anchor: "0x621c126D1cF96Bd2814788c1a19ec6ceF474E1db",
            profileId:
                "0x3cb99d2faa7ad3298c04cf9353e679a6ff3fcb325b981affd3198a80e70a8a4f" as Bytes32String,
        },
    ];

    const createProfileCreatedEvent = (
        project: (typeof projects)[0],
        index: number,
    ): IndexerFetchedEvent<"Registry", "ProfileCreated"> => ({
        blockNumber: 19593900 + index,
        blockTimestamp: (1712373000 + index * 100) as TimestampMs,
        chainId: 1,
        contractName: "Registry",
        eventName: "ProfileCreated",
        logIndex: 660 + index,
        params: {
            name: project.name,
            nonce: (1136007 + index).toString(),
            owner: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            anchor: project.anchor,
            metadata: ["1", "bafkreidl7yst7jpd7ebofslgpdxabn4jsxzhaoc2dwzfnyzh66ll4aqpqm"],
            profileId: project.profileId,
        },
        srcAddress: "0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3",
        transactionFields: {
            from: "0xf3002e97f5ba36BD219C5CB41e6104CFf114e351",
            hash: `0xf47c0e1224954086612c4642807d556a86a50c71a1bdfb720a28bee457474fa${index}`,
            transactionIndex: 99,
        },
    });

    beforeAll(async () => {
        const globalState = {
            databaseUrl: inject("databaseUrl"),
            hasuraUrl: inject("hasuraUrl"),
            envioIndexerUrl: inject("envioIndexerUrl"),
        };

        testHelper = new TestHelper(globalState);
        await testHelper.resetDatabase();

        apiGraphQLClient = new GraphQLClient(`${globalState.hasuraUrl}/v1/graphql`);

        // Create all project events
        const events = projects.map((p, i) => createProfileCreatedEvent(p, i));
        await testHelper.addEvents(events);

        await testHelper.startProcessingService();
        await new Promise((resolve) => setTimeout(resolve, PROCESSING_SERVICE_RUNNING_DELAY_MS));
        await testHelper.stopProcessingService();
    });

    const searchProjects = async (
        searchTerm: string,
    ): Promise<
        {
            id: string;
            name: string;
        }[]
    > => {
        const { searchProjects } = await apiGraphQLClient.request<{
            searchProjects: {
                id: string;
                name: string;
            }[];
        }>(
            gql`
                query SearchProjects($searchTerm: String!) {
                    searchProjects(args: { search_term: $searchTerm }) {
                        id
                        name
                    }
                }
            `,
            { searchTerm },
        );
        return searchProjects;
    };

    it("finds exact matches", async () => {
        const results = await searchProjects("Quantum");
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.name)).toContain("Quantum Development Fund");
        expect(results.map((r) => r.name)).toContain("Quantum Computing Lab");
    });

    it("finds partial word matches", async () => {
        const results = await searchProjects("Development");
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.name)).toContain("Quantum Development Fund");
        expect(results.map((r) => r.name)).toContain("DeFi Develop Grant");
    });

    it("handles multiple word search", async () => {
        const results = await searchProjects("Quantum & Development");
        expect(results).toHaveLength(1);
        expect(results[0]!.name).toBe("Quantum Development Fund");
    });

    it("returns empty array for non-matching search", async () => {
        const results = await searchProjects("NonExistentProject");
        expect(results).toHaveLength(0);
    });

    it("handles case-insensitive search", async () => {
        const results = await searchProjects("quantum");
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.name)).toContain("Quantum Development Fund");
        expect(results.map((r) => r.name)).toContain("Quantum Computing Lab");
    });

    it("returns results ordered by relevance", async () => {
        const results = await searchProjects("Develop");
        expect(results.length).toBeGreaterThan(1);
        // Projects with "Develop" in the name should be ranked higher
        expect(results[1]!.name).toMatch(/DeFi Develop Grant/);
    });
});
