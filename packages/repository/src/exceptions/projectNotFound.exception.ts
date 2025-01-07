import { ChainId, NonRetriableError } from "@grants-stack-indexer/shared";

export class ProjectNotFound extends NonRetriableError {
    constructor(chainId: ChainId, anchorAddress: string) {
        super(`Project not found for chainId: ${chainId} and anchorAddress: ${anchorAddress}`);
    }
}

export class ProjectByRoleNotFound extends NonRetriableError {
    constructor(chainId: ChainId, role: string) {
        super(`Project not found for chainId: ${chainId} and role: ${role}`);
    }
}
