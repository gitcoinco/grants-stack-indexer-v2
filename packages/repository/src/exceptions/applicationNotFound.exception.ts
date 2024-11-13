import { ChainId } from "@grants-stack-indexer/shared";

export class ApplicationNotFound extends Error {
    constructor(chainId: ChainId, roundId: string, recipientId: string) {
        super(
            `Application not found on chain ${chainId} for round ${roundId} and recipient ${recipientId}`,
        );
    }
}
