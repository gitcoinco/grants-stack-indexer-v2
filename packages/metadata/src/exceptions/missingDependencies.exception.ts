import { NonRetriableError } from "@grants-stack-indexer/shared";

export class MissingDependenciesException extends NonRetriableError {
    constructor(dependencies: string[]) {
        super(`Missing dependencies: ${dependencies.join(", ")}`);
    }
}
