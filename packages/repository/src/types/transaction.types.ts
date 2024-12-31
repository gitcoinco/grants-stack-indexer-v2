// packages/repository/src/types/transaction.types.ts
import { Kysely } from "kysely";

import { Database } from "../internal.js";

export type KyselyTransaction = Kysely<Database>;

export type TransactionConnection = KyselyTransaction;
