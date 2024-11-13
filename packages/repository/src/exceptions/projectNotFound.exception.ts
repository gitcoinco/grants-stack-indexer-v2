import { ChainId } from "@grants-stack-indexer/shared";

export class ProjectNotFound extends Error {
    constructor(chainId: ChainId, anchorAddress: string) {
        super(`Project not found for chainId: ${chainId} and anchorAddress: ${anchorAddress}`);
    }
}
