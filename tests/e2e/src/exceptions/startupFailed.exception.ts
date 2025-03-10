import { isNativeError } from "util/types";

import { stringify } from "@grants-stack-indexer/shared";

export class StartupFailed extends Error {
    constructor(serviceName: string, error: unknown) {
        const message = isNativeError(error) ? error.message : stringify(error, null, 2);
        super(`${serviceName} failed to start: ${message}`);
        this.name = "StartupFailed";
        this.stack = error instanceof Error ? error.stack : undefined;
    }
}
