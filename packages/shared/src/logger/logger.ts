import { createLogger, format, transports, Logger as WinstonLogger } from "winston";

import { stringify } from "../internal.js";
import { ILogger } from "./logger.interface.js";

type LogLevel = "error" | "warn" | "info" | "debug" | "verbose";

const validLogLevels: LogLevel[] = ["error", "warn", "info", "debug", "verbose"];

export class Logger implements ILogger {
    private logger: WinstonLogger;
    private static instance: Logger | null;
    private level: LogLevel;

    private constructor() {
        this.level = this.isValidLogLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info";
        this.logger = createLogger({
            level: this.level,
            format: format.combine(
                format.colorize(),
                format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                format.errors({ stack: true }),
                format.printf(
                    ({ level, message, timestamp, stack, className, chainId, ...rest }) => {
                        const parts = [
                            timestamp,
                            chainId ? `[Chain:${chainId}]` : "",
                            level,
                            className ? `[${className}]` : "",
                            ":",
                            stack ?? message ?? "",
                        ];

                        const contextInfo =
                            Object.keys(rest).length > 0 ? `| context: ${stringify(rest)}` : "";

                        return (
                            parts.filter(Boolean).join(" ") + (contextInfo ? ` ${contextInfo}` : "")
                        );
                    },
                ),
            ),
            transports: [new transports.Console()],
        });
    }

    /**
     * Returns the instance of the Logger class.
     * @param level The log level to be used by the logger.
     * @returns The instance of the Logger class.
     */
    public static getInstance(): ILogger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    isValidLogLevel(level?: string): level is LogLevel {
        return validLogLevels.includes(level as LogLevel);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.logger.info(message, context);
    }
    error(error: Error | string, context?: Record<string, unknown>): void {
        if (error instanceof Error) {
            this.logger.log("error", error.message, {
                ...context,
                stack: error.stack,
                cause: error.cause,
            });
        } else {
            this.logger.log("error", error, context);
        }
    }
    warn(message: string, context?: Record<string, unknown>): void {
        this.logger.warn(message, context);
    }
    debug(message: string, context?: Record<string, unknown>): void {
        this.logger.debug(message, context);
    }
    verbose(message: string, context?: Record<string, unknown>): void {
        this.logger.verbose(message, context);
    }
}
