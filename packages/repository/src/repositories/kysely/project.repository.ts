import { Kysely } from "kysely";

import { Address, ChainId } from "@grants-stack-indexer/shared";

import { IProjectRepository } from "../../interfaces/projectRepository.interface.js";
import {
    Database,
    handlePostgresError,
    KyselyTransaction,
    NewPendingProjectRole,
    NewProject,
    NewProjectRole,
    PartialProject,
    PendingProjectRole,
    Project,
    ProjectNotFound,
    ProjectRoleNames,
} from "../../internal.js";

export class KyselyProjectRepository implements IProjectRepository<KyselyTransaction> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schemaName: string,
    ) {}

    // ============================ PROJECTS ============================

    /* @inheritdoc */
    async getProjects(chainId: ChainId): Promise<Project[]> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("projects")
            .where("chainId", "=", chainId)
            .selectAll()
            .execute();
    }

    /* @inheritdoc */
    async getProjectById(chainId: ChainId, projectId: string): Promise<Project | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("projects")
            .where("chainId", "=", chainId)
            .where("id", "=", projectId)
            .selectAll()
            .executeTakeFirst();
    }

    /* @inheritdoc */
    async getProjectByIdOrThrow(chainId: ChainId, projectId: string): Promise<Project> {
        const project = await this.getProjectById(chainId, projectId);
        if (!project) throw new ProjectNotFound(chainId, projectId);
        return project;
    }

    /* @inheritdoc */
    async getProjectByAnchor(
        chainId: ChainId,
        anchorAddress: Address,
    ): Promise<Project | undefined> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("projects")
            .where("chainId", "=", chainId)
            .where("anchorAddress", "=", anchorAddress)
            .selectAll()
            .executeTakeFirst();
    }

    /* @inheritdoc */
    async getProjectByAnchorOrThrow(chainId: ChainId, anchorAddress: Address): Promise<Project> {
        const project = await this.getProjectByAnchor(chainId, anchorAddress);
        if (!project) throw new ProjectNotFound(chainId, anchorAddress);
        return project;
    }

    /* @inheritdoc */
    async insertProject(project: NewProject, tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.insertInto("projects").values(project).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "insertProject",
                additionalData: {
                    project,
                },
            });
        }
    }

    /* @inheritdoc */
    async updateProject(
        where: { id: string; chainId: ChainId },
        project: PartialProject,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .updateTable("projects")
                .set(project)
                .where("id", "=", where.id)
                .where("chainId", "=", where.chainId)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "updateProject",
                additionalData: {
                    where,
                    project,
                },
            });
        }
    }

    // ============================ PROJECT ROLES ============================

    /* @inheritdoc */
    async insertProjectRole(projectRole: NewProjectRole, tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.insertInto("projectRoles").values(projectRole).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "insertProjectRole",
                additionalData: {
                    projectRole,
                },
            });
        }
    }

    /* @inheritdoc */
    async deleteManyProjectRoles(
        chainId: ChainId,
        projectId: string,
        role: ProjectRoleNames,
        address?: Address,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            const query = queryBuilder
                .deleteFrom("projectRoles")
                .where("chainId", "=", chainId)
                .where("projectId", "=", projectId)
                .where("role", "=", role);

            if (address) {
                query.where("address", "=", address);
            }

            await query.execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "deleteManyProjectRoles",
                additionalData: {
                    chainId,
                    projectId,
                    role,
                    address,
                },
            });
        }
    }

    // ============================ PENDING PROJECT ROLES ============================

    /* @inheritdoc */
    async getPendingProjectRoles(): Promise<PendingProjectRole[]> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("pendingProjectRoles")
            .selectAll()
            .execute();
    }

    /* @inheritdoc */
    async getPendingProjectRolesByRole(
        chainId: ChainId,
        role: string,
    ): Promise<PendingProjectRole[]> {
        return this.db
            .withSchema(this.schemaName)
            .selectFrom("pendingProjectRoles")
            .where("chainId", "=", chainId)
            .where("role", "=", role)
            .selectAll()
            .execute();
    }

    /* @inheritdoc */
    async insertPendingProjectRole(
        pendingProjectRole: NewPendingProjectRole,
        tx?: KyselyTransaction,
    ): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder
                .insertInto("pendingProjectRoles")
                .values(pendingProjectRole)
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "insertPendingProjectRole",
                additionalData: {
                    pendingProjectRole,
                },
            });
        }
    }

    /* @inheritdoc */
    async deleteManyPendingProjectRoles(ids: number[], tx?: KyselyTransaction): Promise<void> {
        try {
            const queryBuilder = (tx || this.db).withSchema(this.schemaName);
            await queryBuilder.deleteFrom("pendingProjectRoles").where("id", "in", ids).execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyProjectRepository.name,
                methodName: "deleteManyPendingProjectRoles",
                additionalData: {
                    ids,
                },
            });
        }
    }
}
