import { Hex } from "viem";

import { Branded } from "../internal.js";

export type ChainId = Branded<number, "ChainId">;

export type Bytes32String = Branded<Hex, "Bytes32String">;

export type TimestampMs = Branded<number, "TimestampMs">;
