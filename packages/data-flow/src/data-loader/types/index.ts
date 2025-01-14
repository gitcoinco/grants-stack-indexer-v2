import { Changeset, TransactionConnection } from "@grants-stack-indexer/repository";

export type ChangesetHandler<T extends Changeset["type"]> = (
    changeset: Extract<Changeset, { type: T }>,
    txConnection?: TransactionConnection,
) => Promise<void>;

export type ChangesetHandlers = {
    [K in Changeset["type"]]: ChangesetHandler<K>;
};
