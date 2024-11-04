import { inspect } from "util";

import { environment } from "./config/index.js";
import { ProcessorService } from "./services/processor.service.js";

const main = async (): Promise<void> => {
    const processor = new ProcessorService(environment);
    await processor.start();
};

// Handle uncaught errors
process.on("unhandledRejection", (reason, p) => {
    console.error(`Unhandled Rejection at: \n${inspect(p, undefined, 100)}, \nreason: ${reason}`);
    process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
    console.error(
        `An uncaught exception occurred: ${error}\n` + `Exception origin: ${error.stack}`,
    );
    process.exit(1);
});

// Start the application
main().catch((err) => {
    console.error(`Caught error in main handler: ${err}`);
    process.exit(1);
});
