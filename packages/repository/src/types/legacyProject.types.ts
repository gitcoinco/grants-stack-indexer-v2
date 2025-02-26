import { Generated, Insertable } from "kysely";

import { ChainId } from "@grants-stack-indexer/shared";

export type LegacyProject = {
    id: Generated<string>;
    v1ChainId: ChainId;
    v1ProjectId: string;
    v2ProjectId: string;
};

export type NewLegacyProject = Insertable<LegacyProject>;
export type PartialLegacyProject = Partial<LegacyProject>;
