import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    IProjectRepository,
    NewProject,
    TransactionConnection,
} from "@grants-stack-indexer/repository";
import { Address, ChainId } from "@grants-stack-indexer/shared";

import { createProjectHandlers } from "../../../src/data-loader/handlers/project.handlers.js";

describe("Project Handlers", () => {
    const mockRepository = {
        insertProject: vi.fn(),
        updateProject: vi.fn(),
        insertPendingProjectRole: vi.fn(),
        deleteManyPendingProjectRoles: vi.fn(),
        insertProjectRole: vi.fn(),
        deleteManyProjectRoles: vi.fn(),
    } as unknown as IProjectRepository;
    const mockTxConnection = { query: vi.fn() } as unknown as TransactionConnection;

    const handlers = createProjectHandlers(mockRepository);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handle InsertProject changeset", async () => {
        const project = {
            id: "project-1",
            name: "Test Project",
            nonce: null,
            anchorAddress: null,
            chainId: 1 as ChainId,
            projectNumber: null,
            registryAddress: "0x123" as Address,
            metadataCid: "cid",
            metadata: null,
            createdByAddress: "0x456" as Address,
            createdAtBlock: 100n,
            updatedAtBlock: 100n,
            tags: [],
            projectType: "canonical",
        } as NewProject;

        await handlers.InsertProject(
            {
                type: "InsertProject",
                args: { project },
            },
            mockTxConnection,
        );

        expect(mockRepository.insertProject).toHaveBeenCalledWith(project, mockTxConnection);
    });

    it("handle UpdateProject changeset", async () => {
        const update = {
            type: "UpdateProject",
            args: {
                chainId: 1 as ChainId,
                projectId: "project-1",
                project: {
                    name: "Updated Project",
                    updatedAtBlock: 200n,
                },
            },
        } as const;

        await handlers.UpdateProject(update);

        expect(mockRepository.updateProject).toHaveBeenCalledWith(
            { id: "project-1", chainId: 1 },
            { name: "Updated Project", updatedAtBlock: 200n },
            undefined,
        );
    });

    it("handle InsertPendingProjectRole changeset", async () => {
        const pendingRole = {
            chainId: 1 as ChainId,
            role: "owner",
            address: "0x123" as Address,
            createdAtBlock: 100n,
        };

        await handlers.InsertPendingProjectRole({
            type: "InsertPendingProjectRole",
            args: { pendingProjectRole: pendingRole },
        });

        expect(mockRepository.insertPendingProjectRole).toHaveBeenCalledWith(
            pendingRole,
            undefined,
        );
    });

    it("handle DeletePendingProjectRoles changeset", async () => {
        const changeset = {
            type: "DeletePendingProjectRoles" as const,
            args: {
                ids: [1, 2, 3],
            },
        };

        await handlers.DeletePendingProjectRoles(changeset);

        expect(mockRepository.deleteManyPendingProjectRoles).toHaveBeenCalledWith(
            [1, 2, 3],
            undefined,
        );
    });

    it("handle InsertProjectRole changeset", async () => {
        const projectRole = {
            chainId: 1 as ChainId,
            projectId: "project-1",
            address: "0x123" as Address,
            role: "owner",
            createdAtBlock: 100n,
        } as const;

        await handlers.InsertProjectRole({
            type: "InsertProjectRole",
            args: { projectRole },
        });

        expect(mockRepository.insertProjectRole).toHaveBeenCalledWith(projectRole, undefined);
    });

    it("handle DeleteAllProjectRolesByRole changeset", async () => {
        const changeset = {
            type: "DeleteAllProjectRolesByRole",
            args: {
                projectRole: {
                    chainId: 1 as ChainId,
                    projectId: "project-1",
                    role: "owner",
                },
            },
        } as const;

        await handlers.DeleteAllProjectRolesByRole(changeset);

        expect(mockRepository.deleteManyProjectRoles).toHaveBeenCalledWith(
            changeset.args.projectRole.chainId,
            changeset.args.projectRole.projectId,
            changeset.args.projectRole.role,
            undefined,
            undefined,
        );
    });

    it("handle DeleteAllProjectRolesByRoleAndAddress changeset", async () => {
        const changeset = {
            type: "DeleteAllProjectRolesByRoleAndAddress",
            args: {
                projectRole: {
                    chainId: 1 as ChainId,
                    projectId: "project-1",
                    role: "owner",
                    address: "0x123" as Address,
                },
            },
        } as const;

        await handlers.DeleteAllProjectRolesByRoleAndAddress(changeset);

        expect(mockRepository.deleteManyProjectRoles).toHaveBeenCalledWith(
            changeset.args.projectRole.chainId,
            changeset.args.projectRole.projectId,
            changeset.args.projectRole.role,
            changeset.args.projectRole.address,
            undefined,
        );
    });
});
