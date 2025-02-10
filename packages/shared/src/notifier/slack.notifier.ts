import { isNativeError } from "util/types";
import { IncomingWebhook, IncomingWebhookSendArguments } from "@slack/webhook";

import { ILogger, stringify } from "../internal.js";
import { INotifier, NotifierContext } from "./notifier.interface.js";

interface TransformableInfo {
    message: string;
    context: NotifierContext;
}

const defaultFormatter = (info: TransformableInfo): IncomingWebhookSendArguments => {
    const blocks: IncomingWebhookSendArguments["blocks"] = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `An error has occurred on Chain ${info.context.chainId} on event ${info.context.event?.eventName || "unknown"}`,
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `\`\`\`${stringify(info.message, null, 2)}\`\`\``,
            },
        },
    ];

    if (info.context.stack) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `\`\`\`${stringify(info.context.stack, null, 2)}\`\`\``,
            },
        });
    }

    return { blocks };
};

export interface SlackOptions {
    webhookUrl: string;
    username?: string;
    iconEmoji?: string;
    iconUrl?: string;
    formatter?: (info: TransformableInfo) => IncomingWebhookSendArguments;
}

export class SlackNotifier implements INotifier {
    private webhook: IncomingWebhook;
    private username?: string;
    private iconEmoji?: string;
    private iconUrl?: string;
    private formatter: (info: TransformableInfo) => IncomingWebhookSendArguments;

    /**
     * @param opts - The options for the Slack transport.
     * @param opts.webhookUrl - The URL of the Slack webhook.
     * @param opts.username - The username of the Slack bot. Defaults to "Alert BOT".
     * @param opts.iconEmoji - The emoji of the Slack bot. Defaults to ":rotating_light:".
     * @param opts.iconUrl - The URL of the Slack bot's icon.
     * @param opts.formatter - The formatter for the Slack transport. Defaults to the default formatter.
     */
    constructor(
        opts: SlackOptions,
        private logger: ILogger,
    ) {
        this.username = opts.username || "Alert BOT";
        this.iconEmoji = opts.iconEmoji || ":rotating_light:";
        this.iconUrl = opts.iconUrl;
        this.formatter = opts.formatter || defaultFormatter;
        this.webhook = new IncomingWebhook(opts.webhookUrl);
    }

    /** @inheritdoc */
    async send(message: string, context: NotifierContext): Promise<void> {
        const payload: IncomingWebhookSendArguments = {
            username: this.username,
            icon_emoji: this.iconEmoji,
            icon_url: this.iconUrl,
        };

        const formattedPayload = this.formatter({ message, context });
        Object.assign(payload, formattedPayload);

        try {
            await this.webhook.send(payload);
            this.logger.debug("Notification sent to Slack", {
                className: SlackNotifier.name,
            });
        } catch (error) {
            const errorMessage = isNativeError(error) ? error.message : stringify(error);
            this.logger.error(`Failed to send notification: ${errorMessage}`, {
                className: SlackNotifier.name,
            });
        }
    }
}
