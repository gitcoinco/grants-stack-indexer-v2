import { describe, expect, it, vi } from "vitest";

import { ILogger } from "../../src/internal.js";
import { NotifierFactory } from "../../src/notifier/notifier.factory.js";
import { NotifierConfig } from "../../src/notifier/notifierConfig.interface.js";
import { NullNotifier } from "../../src/notifier/null.notifier.js";
import { SlackNotifier } from "../../src/notifier/slack.notifier.js";

describe("NotifierFactory", () => {
    const logger: ILogger = {
        debug: vi.fn(),
        verbose: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    };

    it("creates SlackNotifier instance with valid Slack configuration", () => {
        const config: NotifierConfig<"slack"> = {
            notifierProvider: "slack",
            opts: {
                webhookUrl: "https://hooks.slack.com/test",
            },
        };

        const notifier = NotifierFactory.create(config, logger);
        expect(notifier).toBeInstanceOf(SlackNotifier);
    });

    it("creates NullNotifier instance for null provider", () => {
        const config = {
            notifierProvider: "null" as const,
        };

        const notifier = NotifierFactory.create(config, logger);
        expect(notifier).toBeInstanceOf(NullNotifier);
    });

    it("creates NullNotifier for unknown provider", () => {
        const config = {
            notifierProvider: "unknown" as const,
        } as unknown as NotifierConfig<"null">;

        const notifier = NotifierFactory.create(config, logger);
        expect(notifier).toBeInstanceOf(NullNotifier);
    });
});
