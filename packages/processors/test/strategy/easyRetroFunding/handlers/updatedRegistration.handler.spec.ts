import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMetadataProvider } from "@grants-stack-indexer/metadata";
import {
    Application,
    ApplicationNotFound,
    IApplicationRepository,
    IProjectRepository,
    IRoundReadRepository,
    PartialApplication,
    Project,
    ProjectNotFound,
    Round,
    RoundNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, Logger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { ERFUpdatedRegistrationHandler } from "../../../../src/processors/strategy/easyRetroFunding/handlers/updatedRegistration.handler.js";
import { createMockEvent } from "../../../mocks/index.js";

describe("ERFUpdatedRegistrationHandler", () => {
    let handler: ERFUpdatedRegistrationHandler;
    let mockRoundRepository: IRoundReadRepository;
    let mockApplicationRepository: IApplicationRepository;
    let mockProjectRepository: IProjectRepository;
    let mockMetadataProvider: IMetadataProvider;
    let mockLogger: Logger;
    let mockEvent: ProcessorEvent<"Strategy", "UpdatedRegistrationWithStatus">;
    const chainId = 10 as ChainId;
    const eventName = "UpdatedRegistrationWithStatus";
    const defaultParams = {
        recipientId: "0x1234567890123456789012345678901234567890",
        status: "1",
        data: "0x0000000000000000000000002c7296a5ec0539f0a018c7176c97c92a9c44e2b4000000000000000000000000e7eb5d2b5b188777df902e89c54570e7ef4f59ce000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000003b6261666b72656967796334336366696e786c6e6168713561617773676869626574763675737273376b6b78663776786d7a626a79726f37366977790000000000",
        sender: "0xcBf407C33d68a55CB594Ffc8f4fD1416Bba39DA5",
    } as const;
    const defaultStrategyId = "0x9fa6890423649187b1f0e8bf4265f0305ce99523c3d11aa36b35a54617bb0ec0";

    beforeEach(() => {
        mockRoundRepository = {
            getRoundByStrategyAddressOrThrow: vi.fn(),
        } as unknown as IRoundReadRepository;
        mockApplicationRepository = {
            getApplicationByAnchorAddressOrThrow: vi.fn(),
        } as unknown as IApplicationRepository;
        mockProjectRepository = {
            getProjectByAnchorOrThrow: vi.fn(),
        } as unknown as IProjectRepository;
        mockMetadataProvider = {
            getMetadata: vi.fn(),
        } as unknown as IMetadataProvider;
        mockLogger = {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
        } as unknown as Logger;
    });

    it("handles a valid registration update event", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { status: "2" },
        });
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;
        const mockRound = { id: "round1" } as Round;
        const mockApplication = {
            id: "app1",
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;
        const mockMetadata = { name: "Test Project" };

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(mockMetadata);

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "UpdateApplication",
                args: {
                    chainId,
                    roundId: "round1",
                    applicationId: "app1",
                    application: {
                        ...mockApplication,
                        metadata: mockMetadata,
                        metadataCid: "bafkreigyc43cfinxlnahq5aawsghibetv6usrs7kkxf7vxmzbjyro76iwy",
                        status: "APPROVED",
                        statusUpdatedAtBlock: BigInt(mockEvent.blockNumber),
                        statusSnapshots: [
                            {
                                status: "APPROVED",
                                updatedAtBlock: mockEvent.blockNumber.toString(),
                                updatedAt: new Date(mockEvent.blockTimestamp),
                            },
                        ],
                    },
                },
            },
        ]);
    });

    it("returns empty array if status is invalid", async () => {
        const invalidStatuses = ["0", "6", "10"];
        for (const status of invalidStatuses) {
            mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
                params: { status },
            });

            handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
                roundRepository: mockRoundRepository,
                applicationRepository: mockApplicationRepository,
                projectRepository: mockProjectRepository,
                metadataProvider: mockMetadataProvider,
                logger: mockLogger,
            });

            const result = await handler.handle();

            expect(result).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[ERFUpdatedRegistrationHandler] Invalid status: ${mockEvent.params.status}`,
            );
        }
    });

    it("throws ProjectNotFound if project is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockRejectedValue(
            new ProjectNotFound(chainId, mockEvent.params.recipientId),
        );

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(ProjectNotFound);
    });

    it("throws RoundNotFound if round is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockRejectedValue(
            new RoundNotFound(chainId, mockEvent.strategyId),
        );

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(RoundNotFound);
    });

    it("throws ApplicationNotFound if application is not found", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;
        const mockRound = { id: "round1" } as Round;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockRejectedValue(
            new ApplicationNotFound(chainId, mockRound.id, mockEvent.params.recipientId),
        );

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        await expect(handler.handle()).rejects.toThrow(ApplicationNotFound);
    });

    it("handles undefined metadata", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId);
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;
        const mockRound = { id: "round1" } as Round;
        const mockApplication = {
            id: "app1",
            status: "PENDING",
            statusSnapshots: [],
            statusUpdatedAtBlock: 12344n,
        } as unknown as Application;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(undefined);

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        const changeset = result[0] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset.args.application.metadata).toBeNull();
    });

    it("doesn't add status snapshot if status hasn't changed", async () => {
        mockEvent = createMockEvent(eventName, defaultParams, defaultStrategyId, {
            params: { status: "1" },
        }); // 1 is PENDING
        const mockProject = {
            id: "project1",
            anchorAddress: mockEvent.params.recipientId,
        } as Project;
        const mockRound = { id: "round1" } as Round;
        const mockApplication = {
            id: "app1",
            status: "PENDING", // Same status as in the event
            statusSnapshots: [
                {
                    status: "PENDING",
                    updatedAtBlock: "12344",
                    updatedAt: new Date(1000000000),
                },
            ],
            statusUpdatedAtBlock: 12344n,
        } as Application;

        vi.spyOn(mockProjectRepository, "getProjectByAnchorOrThrow").mockResolvedValue(mockProject);
        vi.spyOn(mockRoundRepository, "getRoundByStrategyAddressOrThrow").mockResolvedValue(
            mockRound,
        );
        vi.spyOn(
            mockApplicationRepository,
            "getApplicationByAnchorAddressOrThrow",
        ).mockResolvedValue(mockApplication);
        vi.spyOn(mockMetadataProvider, "getMetadata").mockResolvedValue(null);

        handler = new ERFUpdatedRegistrationHandler(mockEvent, chainId, {
            roundRepository: mockRoundRepository,
            applicationRepository: mockApplicationRepository,
            projectRepository: mockProjectRepository,
            metadataProvider: mockMetadataProvider,
            logger: mockLogger,
        });

        const result = await handler.handle();

        expect(result).toHaveLength(1);
        const changeset = result[0] as {
            type: "UpdateApplication";
            args: { application: PartialApplication };
        };
        expect(changeset.args.application.statusSnapshots).toHaveLength(1);
        expect(changeset.args.application.status).toBe("PENDING");
        expect(changeset.args.application.statusSnapshots).toEqual(mockApplication.statusSnapshots);
    });
});
