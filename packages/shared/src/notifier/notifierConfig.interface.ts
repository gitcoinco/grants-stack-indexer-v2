import { SlackOptions } from "./slack.notifier.js";

export type NotifierProvider = "slack" | "null";

export type SlackNotifierConfig = {
    notifierProvider: "slack";
    opts: SlackOptions;
};

export type NotifierConfig<Source extends NotifierProvider> = Source extends "slack"
    ? SlackNotifierConfig
    : {
          notifierProvider: "null";
      };
