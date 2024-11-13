import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IProjectRepository,
    Project,
    ProjectByRoleNotFound,
} from "@grants-stack-indexer/repository";
import { ChainId, ILogger, ProcessorEvent } from "@grants-stack-indexer/shared";

import { RoleRevokedHandler } from "../../../src/processors/registry/handlers/roleRevoked.handler.js";

describe("RoleRevokedHandler", () => {
    let mockEvent: ProcessorEvent<"Registry", "RoleRevoked">;
    let mockChainId: ChainId;
    let mockDependencies: { projectRepository: IProjectRepository; logger: ILogger };
    let mockedRole: string;
    let mockedAccount: string;

    beforeEach(() => {
        mockedRole = "0x5aD1D85Bb68791Cb3cE598f56E00F5D5694FAd14ASD";
        mockedAccount = "0x5aD1D85Bb68791Cb3cE598f56E00F5D5694FAd14";
        mockEvent = {
            params: {
                account: mockedAccount,
                role: mockedRole,
            },
        } as ProcessorEvent<"Registry", "RoleRevoked">;

        mockChainId = 1 as ChainId;

        mockDependencies = {
            projectRepository: {
                getProjectById: vi.fn(),
            } as unknown as IProjectRepository,
            logger: {
                info: vi.fn(),
            } as unknown as ILogger,
        };
    });

    it("return a changeset when project is found", async () => {
        const project = { id: "project-1" };
        vi.spyOn(mockDependencies.projectRepository, "getProjectById").mockResolvedValueOnce({
            ...project,
        } as Project);

        const handler = new RoleRevokedHandler(mockEvent, mockChainId, mockDependencies);
        const result = await handler.handle();

        expect(result).toEqual([
            {
                type: "DeleteAllProjectRolesByRoleAndAddress",
                args: {
                    projectRole: {
                        chainId: mockChainId,
                        projectId: project.id,
                        address: mockedAccount,
                        role: "member",
                    },
                },
            },
        ]);
    });

    it("return an empty array when project is not found", async () => {
        vi.spyOn(mockDependencies.projectRepository, "getProjectById").mockResolvedValueOnce(
            undefined,
        );

        const handler = new RoleRevokedHandler(mockEvent, mockChainId, mockDependencies);

        await expect(handler.handle()).rejects.toThrow(ProjectByRoleNotFound);
    });

    it("throw an error when getProjectById fails", async () => {
        const error = new ProjectByRoleNotFound(
            mockEvent.chainId as ChainId,
            mockEvent.params.role,
        );
        vi.spyOn(mockDependencies.projectRepository, "getProjectById").mockRejectedValueOnce(error);

        const handler = new RoleRevokedHandler(mockEvent, mockChainId, mockDependencies);

        await expect(handler.handle()).rejects.toThrow(error);
    });
});
