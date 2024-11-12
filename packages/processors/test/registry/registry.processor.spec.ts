import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChainId, ProcessorEvent, RegistryEvent } from "@grants-stack-indexer/shared";

import { ProcessorDependencies, UnsupportedEventException } from "../../src/internal.js";
import { ProfileCreatedHandler } from "../../src/processors/registry/handlers/profileCreated.handler.js";
import { RoleGrantedHandler } from "../../src/processors/registry/handlers/roleGranted.handler.js";
import { RegistryProcessor } from "../../src/processors/registry/registry.processor.js";

// Mock the handlers and their handle methods
vi.mock("../../src/processors/registry/handlers/roleGranted.handler.js", () => {
    const RoleGrantedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    RoleGrantedHandler.prototype.handle = vi.fn();
    return {
        RoleGrantedHandler,
    };
});

// Mock the handlers and their handle methods
vi.mock("../../src/processors/registry/handlers/profileCreated.handler.js", () => {
    const ProfileCreatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileCreatedHandler.prototype.handle = vi.fn();
    return {
        ProfileCreatedHandler,
    };
});

describe("RegistryProcessor", () => {
    const chainId: ChainId = 10 as ChainId; // Replace with appropriate chainId
    const dependencies: ProcessorDependencies = {} as ProcessorDependencies; // Replace with actual dependencies

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("throws UnsupportedEventException for unsupported events", async () => {
        const event: ProcessorEvent<"Registry", RegistryEvent> = {
            eventName: "UnsupportedEvent",
        } as unknown as ProcessorEvent<"Registry", RegistryEvent>;

        const processor = new RegistryProcessor(chainId, dependencies);

        await expect(processor.process(event)).rejects.toThrow(UnsupportedEventException);
    });

    it("should call ProfileCreatedHandler", async () => {
        const event: ProcessorEvent<"Registry", "ProfileCreated"> = {
            eventName: "ProfileCreated",
        } as ProcessorEvent<"Registry", "ProfileCreated">;

        vi.spyOn(ProfileCreatedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(ProfileCreatedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });

    it("should call RoleGrantedHandler", async () => {
        const event: ProcessorEvent<"Registry", "RoleGranted"> = {
            eventName: "RoleGranted",
        } as ProcessorEvent<"Registry", "RoleGranted">;

        vi.spyOn(RoleGrantedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(RoleGrantedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
});
