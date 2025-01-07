import { NonRetriableError } from "@grants-stack-indexer/shared";

export class InvalidChangeset extends NonRetriableError {
    constructor(invalidTypes: string[]) {
        super(`Invalid changeset types: ${invalidTypes.join(", ")}`);
    }
}
