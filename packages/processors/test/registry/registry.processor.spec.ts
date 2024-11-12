import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChainId, ProcessorEvent, RegistryEvent } from "@grants-stack-indexer/shared";

import { ProcessorDependencies, UnsupportedEventException } from "../../src/internal.js";
import { ProfileCreatedHandler } from "../../src/processors/registry/handlers/profileCreated.handler.js";
import { ProfileMetadataUpdatedHandler } from "../../src/processors/registry/handlers/profileMetadataUpdated.handler.js";
import { ProfileNameUpdatedHandler } from "../../src/processors/registry/handlers/profileNameUpdated.handler.js";
import { ProfileOwnerUpdatedHandler } from "../../src/processors/registry/handlers/profileOwnerUpdated.handler.js";
import { RoleGrantedHandler } from "../../src/processors/registry/handlers/roleGranted.handler.js";
import { RoleRevokedHandler } from "../../src/processors/registry/handlers/roleRevoked.handler.js";
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

vi.mock("../../src/processors/registry/handlers/profileCreated.handler.js", () => {
    const ProfileCreatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileCreatedHandler.prototype.handle = vi.fn();
    return {
        ProfileCreatedHandler,
    };
});

vi.mock("../../src/processors/registry/handlers/profileOwnerUpdated.handler.js", () => {
    const ProfileOwnerUpdatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileOwnerUpdatedHandler.prototype.handle = vi.fn();
    return {
        ProfileOwnerUpdatedHandler,
    };
});

vi.mock("../../src/processors/registry/handlers/roleRevoked.handler.js", () => {
    const RoleRevokedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    RoleRevokedHandler.prototype.handle = vi.fn();
    return {
        RoleRevokedHandler,
    };
});
vi.mock("../../src/processors/registry/handlers/profileMetadataUpdated.handler.js", () => {
    const ProfileMetadataUpdatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileMetadataUpdatedHandler.prototype.handle = vi.fn();
    return {
        ProfileMetadataUpdatedHandler,
    };
});
vi.mock("../../src/processors/registry/handlers/profileNameUpdated.handler.js", () => {
    const ProfileNameUpdatedHandler = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ProfileNameUpdatedHandler.prototype.handle = vi.fn();
    return {
        ProfileNameUpdatedHandler,
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

    it("calls ProfileCreatedHandler", async () => {
        const event: ProcessorEvent<"Registry", "ProfileCreated"> = {
            eventName: "ProfileCreated",
        } as ProcessorEvent<"Registry", "ProfileCreated">;

        vi.spyOn(ProfileCreatedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(ProfileCreatedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });

    it("calls RoleGrantedHandler", async () => {
        const event: ProcessorEvent<"Registry", "RoleGranted"> = {
            eventName: "RoleGranted",
        } as ProcessorEvent<"Registry", "RoleGranted">;

        vi.spyOn(RoleGrantedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(RoleGrantedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
    it("calls ProfileOwnerUpdatedHandler", async () => {
        const event: ProcessorEvent<"Registry", "ProfileOwnerUpdated"> = {
            eventName: "ProfileOwnerUpdated",
        } as ProcessorEvent<"Registry", "ProfileOwnerUpdated">;

        vi.spyOn(ProfileOwnerUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(ProfileOwnerUpdatedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
    it("calls RoleRevokedHandler", async () => {
        const event: ProcessorEvent<"Registry", "RoleRevoked"> = {
            eventName: "RoleRevoked",
        } as ProcessorEvent<"Registry", "RoleRevoked">;

        vi.spyOn(RoleRevokedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(RoleRevokedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
    it("calls ProfileMetadataUpdatedHandler", async () => {
        const event: ProcessorEvent<"Registry", "ProfileMetadataUpdated"> = {
            eventName: "ProfileMetadataUpdated",
        } as ProcessorEvent<"Registry", "ProfileMetadataUpdated">;

        vi.spyOn(ProfileMetadataUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(ProfileMetadataUpdatedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
    it("calls ProfileNameUpdatedHandler", async () => {
        const event: ProcessorEvent<"Registry", "ProfileNameUpdated"> = {
            eventName: "ProfileNameUpdated",
        } as ProcessorEvent<"Registry", "ProfileNameUpdated">;

        vi.spyOn(ProfileNameUpdatedHandler.prototype, "handle").mockResolvedValue([]);

        const processor = new RegistryProcessor(chainId, dependencies);
        const result = await processor.process(event);

        expect(ProfileNameUpdatedHandler.prototype.handle).toHaveBeenCalled();
        expect(result).toEqual([]); // Check if handle returns []
    });
});
