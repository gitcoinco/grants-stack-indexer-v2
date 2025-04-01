import { IncomingWebhook } from "@slack/webhook";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ILogger } from "../../src/internal.js";
import { NotifierContext } from "../../src/notifier/notifier.interface.js";
import { SlackNotifier, SlackOptions } from "../../src/notifier/slack.notifier.js";
import { AnyIndexerFetchedEvent, ChainId } from "../../src/types/index.js";

vi.mock("@slack/webhook", () => ({
    IncomingWebhook: vi.fn().mockImplementation(() => ({
        send: vi.fn().mockResolvedValue(undefined),
    })),
}));

describe("SlackNotifier", () => {
    let logger: ILogger;
    let options: SlackOptions;
    let notifier: SlackNotifier;
    let mockWebhook: IncomingWebhook;

    beforeEach(() => {
        logger = {
            debug: vi.fn(),
            verbose: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };

        options = {
            webhookUrl: "https://hooks.slack.com/test",
            username: "Test Bot",
            iconEmoji: ":test:",
        };

        notifier = new SlackNotifier(options, logger);
        mockWebhook = notifier["webhook"];
    });

    it("initializes with default values when minimal options provided", () => {
        const minimalNotifier = new SlackNotifier(
            { webhookUrl: "https://hooks.slack.com/test" },
            logger,
        );
        expect(minimalNotifier).toBeDefined();
    });

    it("throws TypeError if webhook URL is invalid", () => {
        expect(() => new SlackNotifier({ webhookUrl: "invalid-url" }, logger)).toThrow(TypeError);
    });

    it("sends formatted message to Slack", async () => {
        const message = "Test error message";
        const context: NotifierContext = {
            chainId: 1 as ChainId,
            event: { eventName: "ProfileCreated" } as AnyIndexerFetchedEvent,
            stack: "test stack",
        };

        await notifier.send(message, context);

        expect(mockWebhook.send).toHaveBeenCalledWith(
            expect.objectContaining({
                username: "Test Bot",
                icon_emoji: ":test:",
                blocks: expect.arrayContaining([
                    expect.objectContaining({
                        text: expect.objectContaining({
                            text: expect.stringContaining("1"),
                        }),
                    }),
                ]),
            }),
        );
        expect(logger.debug).toHaveBeenCalled();
    });

    it("handles stack trace in context", async () => {
        const message = "Test error message";
        const context: NotifierContext = {
            chainId: 1 as ChainId,
            event: { eventName: "ProfileCreated" } as AnyIndexerFetchedEvent,
            stack: "Error stack trace",
        };

        await notifier.send(message, context);

        expect(mockWebhook.send).toHaveBeenCalledWith(
            expect.objectContaining({
                blocks: expect.arrayContaining([
                    expect.objectContaining({
                        text: expect.objectContaining({
                            text: expect.stringContaining("Error stack trace"),
                        }),
                    }),
                ]),
            }),
        );
    });

    it("logs error when webhook send fails", async () => {
        const error = new Error("Webhook error");
        vi.mocked(mockWebhook.send).mockRejectedValueOnce(error);

        const message = "Test error message";
        const context: NotifierContext = {
            chainId: 1 as ChainId,
            event: { eventName: "ProfileCreated" } as AnyIndexerFetchedEvent,
            stack: "test stack",
        };

        await notifier.send(message, context);

        expect(logger.error).toHaveBeenCalled();
    });
});
