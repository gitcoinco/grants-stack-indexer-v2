import { AnyIndexerFetchedEvent, ChainId } from "../internal.js";

/**
 * Context information for notifications.
 * @property event - Optional event that triggered the notification.
 * @property chainId - The chain ID where the event occurred.
 * @property stack - Optional stack trace for error notifications.
 */
export type NotifierContext = {
    event?: AnyIndexerFetchedEvent;
    chainId: ChainId;
    stack?: string;
};

export interface INotifier {
    /**
     * Sends a notification to the notifier provider.
     * @param message - The message to notify.
     * @param context - The context information for the notification.
     * @returns A promise that resolves when the notification is sent.
     */
    send(message: string, context: NotifierContext): Promise<void>;
}
