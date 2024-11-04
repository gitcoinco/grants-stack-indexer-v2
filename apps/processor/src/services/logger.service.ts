import { ILogger } from "@grants-stack-indexer/shared";

export class Logger implements ILogger {
    info(message: string): void {
        console.log(`[INFO] ${message}`);
    }

    warn(message: string): void {
        console.warn(`[WARN] ${message}`);
    }

    error(message: Error | string): void {
        console.error(`[ERROR] ${message}`);
    }

    debug(message: string): void {
        console.debug(`[DEBUG] ${message}`);
    }
}
