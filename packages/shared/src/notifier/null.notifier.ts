import { INotifier, NotifierContext } from "../internal.js";

/**
 * A null implementation of INotifier that performs no actions but allows the application to have an undefined notifier if desired
 */
export class NullNotifier implements INotifier {
    async send(_message: string, _context: NotifierContext): Promise<void> {
        // Do nothing
    }
}
