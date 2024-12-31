import { Transaction } from "kysely";

import { Database } from "../internal.js";

export type KyselyTransaction = Transaction<Database>;

export type TransactionConnection = KyselyTransaction;
