import { describe, expect, it } from "vitest";

import { AnyIndexerFetchedEvent } from "@grants-stack-indexer/shared";

import { getMetadataCidsFromEvents } from "../../../src/helpers/index.js";

describe("getMetadataCidsFromEvents", () => {
    it("should extract metadata CID from PoolCreated event", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    metadata: ["1", "bafkreihrjyu5tney6wia2hmkertc74nzfpsgxw2epvnxm72bxj6ifnd4ku"],
                },
            } as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events);
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

        const result = getMetadataCidsFromEvents(events);
        expect(result).toEqual([]);
    });
});
