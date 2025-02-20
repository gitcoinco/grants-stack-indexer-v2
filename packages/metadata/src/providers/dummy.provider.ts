import type { IMetadataProvider } from "../internal.js";

export class DummyMetadataProvider implements IMetadataProvider {
    /* @inheritdoc */
    async getMetadata<T>(_ipfsCid: string): Promise<T | undefined> {
        return undefined;
    }
}
