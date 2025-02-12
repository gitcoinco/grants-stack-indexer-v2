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
    it("should extract metadata CID from DVMDApplicationData", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    data: "0x00000000000000000000000058aff8eefebbd2625fcdb55d373f4ac6031d05ab000000000000000000000000500b7be3c9a6d81db4431cd28d8a6a9e24326e6c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b726569656b75343435747435686367696c797172786b65656f336e676769646c3374636170626d68766c767a706471636a6d37337669750000000000",
                },
            } as unknown as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events, logger);
        expect(result).toEqual(["bafkreieku445tt5hcgilyqrxkeeo3nggidl3tcapbmhvlvzpdqcjm73viu"]);
    });

    it("should extract metadata CID from DGApplicationData", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    data: "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000010000000000000000000000000004326f29680a757405278b556a95b7102d5dc8d80000000000000000000000001ca656eb3b457a0e34c11b2ecf7e8159bece4cb6000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967637a6572333763753571776a343634333235346736326565633568766e6d656d6b626e77736237746f336e68736677743433340000000000",
                },
            } as unknown as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events, logger);
        expect(result).toEqual(["bafkreigczer37cu5qwj4643254g62eec5hvnmemkbnwsb7to3nhsfwt434"]);
    });

    it("should extract metadata CID from DVMDExtendedApplicationData", () => {
        const events: AnyIndexerFetchedEvent[] = [
            {
                params: {
                    data: "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000010000000000000000000000000004326f29680a757405278b556a95b7102d5dc8d80000000000000000000000001ca656eb3b457a0e34c11b2ecf7e8159bece4cb6000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967637a6572333763753571776a343634333235346736326565633568766e6d656d6b626e77736237746f336e68736677743433340000000000",
                },
            } as unknown as AnyIndexerFetchedEvent,
        ];

        const result = getMetadataCidsFromEvents(events, logger);
        expect(result).toEqual(["bafkreigczer37cu5qwj4643254g62eec5hvnmemkbnwsb7to3nhsfwt434"]);
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
