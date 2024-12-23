import { inspect } from "util";

import { environment } from "./config/index.js";
import { ProcessingService } from "./services/processing.service.js";

let processor: ProcessingService;

const main = async (): Promise<void> => {
    processor = await ProcessingService.initialize(environment);
    await processor.processRetroactiveEvents();
};

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

main()
    .catch((err) => {
        console.error(`Caught error in main handler: ${err}`);
        process.exit(1);
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .finally(async () => {
        await processor?.releaseResources();
    });
