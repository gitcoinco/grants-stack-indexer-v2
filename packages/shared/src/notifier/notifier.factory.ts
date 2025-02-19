import { ILogger, NullNotifier, SlackNotifier } from "../internal.js";
import { INotifier, NotifierConfig, NotifierProvider } from "./index.js";

/**
 * Factory class to create instances of INotifier based on configuration.
 */
export class NotifierFactory {
    /**
     * Creates an instance of INotifier based on configuration.
     *
     * @param {NotifierConfig<NotifierProvider>} options - The configuration for the notifier.
     * @returns {INotifier} An instance of INotifier.
     */
    static create(options: NotifierConfig<NotifierProvider>, logger: ILogger): INotifier {
        let notifier: INotifier;

        switch (options.notifierProvider) {
            case "slack":
                notifier = new SlackNotifier(options.opts, logger);
                break;
            // Can add more notification services here, like TelegramNotifier, etc.
            default:
                notifier = new NullNotifier();
        }

        return notifier;
    }
}
