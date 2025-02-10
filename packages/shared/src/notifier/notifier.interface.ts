import { AnyIndexerFetchedEvent, ChainId } from "../internal.js";

export type NotifierContext = {
    event?: AnyIndexerFetchedEvent;
    chainId: ChainId;
    stack?: string;
};

export interface INotifier {
    /**
     * Sends a notification to the notifier provider.
     * @param message - The message to notify.
     */
    send(message: string, context: NotifierContext): Promise<void>;
}
