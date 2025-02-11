import { SlackOptions } from "./index.js";

export type NotifierProvider = "slack" | "null";

/**
 * Configuration type for the Slack notifier.
 * @property notifierProvider - Must be set to "slack" to use Slack notifications.
 * @property opts - Slack-specific configuration options.
 */
export type SlackNotifierConfig = {
    notifierProvider: "slack";
    opts: SlackOptions;
};

/**
 * Generic configuration type for notifiers.
 * @template Source - The type of notifier provider to configure.
 * @returns Configuration type specific to the provider: SlackNotifierConfig for "slack", or a null configuration otherwise.
 */
export type NotifierConfig<Source extends NotifierProvider> = Source extends "slack"
    ? SlackNotifierConfig
    : {
          notifierProvider: "null";
      };
