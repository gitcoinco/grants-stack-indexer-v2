import { Address, ChainId } from "@grants-stack-indexer/shared";

export type ProjectType = "canonical" | "linked";

export type Project = {
    id: string;
    name: string;
    nonce: bigint | null;
    anchorAddress: Address | null;
    chainId: ChainId;
    projectNumber: number | null;
    registryAddress: Address;
    metadataCid: string | null;
    metadata: unknown | null;
    createdByAddress: Address;
    createdAtBlock: bigint;
    updatedAtBlock: bigint;
    tags: string[];
    projectType: ProjectType;
};

export type NewProject = Project;
export type PartialProject = Partial<Project>;

export type ProjectRoleNames = "owner" | "member";

export type ProjectRole = {
    chainId: ChainId;
    projectId: string;
    address: Address;
    role: ProjectRoleNames;
    createdAtBlock: bigint;
};

export type NewProjectRole = ProjectRole;
export type PartialProjectRole = Partial<ProjectRole>;

// In Allo V2 profile roles are emitted before a profile exists.
// The role emitted is the profile id.
// Once a profile is created we search for roles with that profile id
// and add real project roles. After that we can remove the pending project roles.
export type PendingProjectRole = {
    id?: number;
    chainId: ChainId;
    role: string;
    address: Address;
    createdAtBlock: bigint;
};

export type NewPendingProjectRole = Omit<PendingProjectRole, "id">;
export type PartialPendingProjectRole = Partial<PendingProjectRole>;
