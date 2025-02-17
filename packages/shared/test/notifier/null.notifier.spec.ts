import { describe, expect, it, vi } from "vitest";

import { NotifierContext } from "../../src/notifier/notifier.interface.js";
import { NullNotifier } from "../../src/notifier/null.notifier.js";
import { AnyIndexerFetchedEvent, ChainId } from "../../src/types/index.js";

describe("NullNotifier", () => {
    it("sends message without performing any action", async () => {
        const notifier = new NullNotifier();
        const context: NotifierContext = {
            chainId: 1 as ChainId,
            event: { eventName: "ProfileCreated" } as AnyIndexerFetchedEvent,
            stack: "test stack",
        };

        const consoleSpy = vi.spyOn(console, "log");

        const result = await notifier.send("test message", context);
        expect(result).toBeUndefined();
        expect(consoleSpy).not.toHaveBeenCalled();
    });
});
