import { Kysely } from "kysely";

import { Database, handlePostgresError, ICache } from "../../internal.js";

export class KyselyMetadataCache implements ICache<string> {
    constructor(
        private readonly db: Kysely<Database>,
        private readonly schema: string,
    ) {}

    /** @inheritdoc */
    async get<T>(id: string): Promise<T | undefined> {
        try {
            const result = await this.db
                .withSchema(this.schema)
                .selectFrom("metadataCache")
                .select("metadata")
                .where("id", "=", id)
                .executeTakeFirst();

            if (!result) {
                return undefined;
            }

            return result.metadata as T;
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyMetadataCache.name,
                methodName: "get",
                additionalData: {
                    id,
                },
            });
        }
    }

    /** @inheritdoc */
    async set<T>(id: string, metadata: T): Promise<void> {
        try {
            await this.db
                .withSchema(this.schema)
                .insertInto("metadataCache")
                .values({
                    id: id,
                    metadata: metadata as unknown,
                    createdAt: new Date(),
                })
                .onConflict((oc) =>
                    oc.column("id").doUpdateSet({
                        metadata: metadata as unknown,
                        createdAt: new Date(),
                    }),
                )
                .execute();
        } catch (error) {
            throw handlePostgresError(error, {
                className: KyselyMetadataCache.name,
                methodName: "set",
                additionalData: {
                    id,
                    metadata,
                },
            });
        }
    }
}
