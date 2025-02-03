import type { IMetadataProvider } from "../internal.js";

export class DummyMetadataProvider implements IMetadataProvider {
    constructor() {}

    /* @inheritdoc */
    async getMetadata<T>(_ipfsCid: string): Promise<T | undefined> {
        return undefined;
    }
}
