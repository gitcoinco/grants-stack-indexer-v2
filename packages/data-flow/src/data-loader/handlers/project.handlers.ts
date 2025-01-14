import { IProjectRepository, ProjectChangeset } from "@grants-stack-indexer/repository";

import { ChangesetHandler } from "../types/index.js";

/**
 * Collection of handlers for project-related operations.
 * Each handler corresponds to a specific Project changeset type.
 */
export type ProjectHandlers = {
    [K in ProjectChangeset["type"]]: ChangesetHandler<K>;
};

/**
 * Creates handlers for managing project-related operations.
 *
 * @param repository - The project repository instance used for database operations
 * @returns An object containing all project-related handlers
 */
export const createProjectHandlers = (repository: IProjectRepository): ProjectHandlers => ({
    InsertProject: (async (changeset, txConnection): Promise<void> => {
        const { project } = changeset.args;
        await repository.insertProject(project, txConnection);
    }) satisfies ChangesetHandler<"InsertProject">,

    UpdateProject: (async (changeset, txConnection): Promise<void> => {
        const { chainId, projectId, project } = changeset.args;
        await repository.updateProject({ id: projectId, chainId }, project, txConnection);
    }) satisfies ChangesetHandler<"UpdateProject">,

    InsertPendingProjectRole: (async (changeset, txConnection): Promise<void> => {
        const { pendingProjectRole } = changeset.args;
        await repository.insertPendingProjectRole(pendingProjectRole, txConnection);
    }) satisfies ChangesetHandler<"InsertPendingProjectRole">,

    DeletePendingProjectRoles: (async (changeset, txConnection): Promise<void> => {
        const { ids } = changeset.args;
        await repository.deleteManyPendingProjectRoles(ids, txConnection);
    }) satisfies ChangesetHandler<"DeletePendingProjectRoles">,

    InsertProjectRole: (async (changeset, txConnection): Promise<void> => {
        const { projectRole } = changeset.args;
        await repository.insertProjectRole(projectRole, txConnection);
    }) satisfies ChangesetHandler<"InsertProjectRole">,

    DeleteAllProjectRolesByRole: (async (changeset, txConnection): Promise<void> => {
        const { chainId, projectId, role } = changeset.args.projectRole;
        await repository.deleteManyProjectRoles(chainId, projectId, role, undefined, txConnection);
    }) satisfies ChangesetHandler<"DeleteAllProjectRolesByRole">,

    DeleteAllProjectRolesByRoleAndAddress: (async (changeset, txConnection): Promise<void> => {
        const { chainId, projectId, role, address } = changeset.args.projectRole;
        await repository.deleteManyProjectRoles(chainId, projectId, role, address, txConnection);
    }) satisfies ChangesetHandler<"DeleteAllProjectRolesByRoleAndAddress">,
});
