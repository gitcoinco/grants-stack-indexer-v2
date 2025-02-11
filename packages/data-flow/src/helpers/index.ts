import {
    decodeDGApplicationData,
    decodeDVMDApplicationData,
    decodeDVMDExtendedApplicationData,
} from "@grants-stack-indexer/processors";
import { AnyIndexerFetchedEvent, ILogger } from "@grants-stack-indexer/shared";

/**
 * Extracts unique metadata ids from the events batch.
 * @param events - Array of indexer fetched events to process
 * @returns Array of unique metadata ids found in the events
 */
export const getMetadataCidsFromEvents = (
    events: AnyIndexerFetchedEvent[],
    logger: ILogger,
): string[] => {
    const ids = new Set<string>();

    for (const event of events) {
        if ("metadata" in event.params) {
            ids.add(event.params.metadata[1]);
        } else if ("data" in event.params) {
            try {
                const decoded = decodeDGApplicationData(event.params.data);
                ids.add(decoded.metadata.pointer);
            } catch (error) {}
            try {
                const decoded = decodeDVMDApplicationData(event.params.data);
                ids.add(decoded.metadata.pointer);
            } catch (error) {}
            try {
                const decoded = decodeDVMDExtendedApplicationData(event.params.data);
                ids.add(decoded.metadata.pointer);
            } catch (error) {
                logger.warn("Failed to decode DVMD extended application data", {
                    error,
                    event,
                });
            }
        }
    }

    return Array.from(ids);
};
