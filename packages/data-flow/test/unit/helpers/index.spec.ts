import { describe, expect, it, vi } from "vitest";

import { AnyIndexerFetchedEvent, ILogger } from "@grants-stack-indexer/shared";

import { getMetadataCidsFromEvents } from "../../../src/helpers/index.js";

describe("getMetadataCidsFromEvents", () => {
    //mock logger
    const logger = {
        warn: vi.fn(),
    } as unknown as ILogger;

    it("should extract metadata CID from PoolCreated event", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    metadata: ["1", "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku"],
                },
            } as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events, logger);
        expect(result).toEqual(["bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku"]);
    });

    it("should skip events without metadata or data", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    amount: "value",
                },
            } as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events, logger);
        expect(result).toEqual([]);
    });
});
