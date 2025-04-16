import { Application } from "@grants-stack-indexer/repository";

/**
 * Checks if an application status index is valid (between 1 and 5)
 * @see ApplicationStatus
 */
export function isValidApplicationStatus(status: number): boolean {
    return status >= 1 && status <= 5;
}

type StatusUpdateParams = {
    application: Application;
    newStatus: Application["status"];
    blockNumber: number;
    blockTimestamp: number;
};

/**
 * Creates a status update object for an application
 * @param application - The application.
 * @param newStatus - The new status.
 * @param blockNumber - The block number.
 * @param blockTimestamp - The block timestamp.
 * @returns a Partial<Application>
 */
export function createStatusUpdate({
    application,
    newStatus,
    blockNumber,
    blockTimestamp,
}: StatusUpdateParams): Pick<Application, "status" | "statusUpdatedAtBlock" | "statusSnapshots"> {
    const statusSnapshots = [...application.statusSnapshots];

    if (application.status !== newStatus) {
        statusSnapshots.push({
            status: newStatus,
            updatedAtBlock: blockNumber.toString(),
            updatedAt: new Date(blockTimestamp),
        });
    }

    return {
        status: newStatus,
        statusUpdatedAtBlock: BigInt(blockNumber),
        statusSnapshots,
    };
}
