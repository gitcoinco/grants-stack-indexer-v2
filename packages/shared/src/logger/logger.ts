import { createLogger, format, transports, Logger as WinstonLogger } from "winston";

import { ChainId } from "../internal.js";
import { ILogger } from "./logger.interface.js";

type LogLevel = "error" | "warn" | "info" | "debug";

const validLogLevels: LogLevel[] = ["error", "warn", "info", "debug"];

export class Logger implements ILogger {
    private logger: WinstonLogger;
    private level: LogLevel;

    constructor(config: { chainId?: ChainId; className?: string } = {}) {
        const { chainId, className } = config;
        this.level = this.isValidLogLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info";
        this.logger = createLogger({
            level: this.level,
            defaultMeta: { chainId, className },
            format: format.combine(
                format.colorize(),
                format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
                format.errors({ stack: true }),
                format.printf(({ level, message, timestamp, stack, chainId, className }) => {
                    return `${chainId ? `[Chain:${chainId}] ` : ""}${className ? `[${className}] ` : ""}${timestamp} ${level}: ${stack ?? message ?? ""}`;
                }),
            ),
            transports: [new transports.Console()],
        });
    }

    isValidLogLevel(level?: string): level is LogLevel {
        return validLogLevels.includes(level as LogLevel);
    }

    info(message: string): void {
        this.logger.info(message);
    }
    error(error: Error | string): void {
        if (error instanceof Error) {
            this.logger.error(error);
        } else {
            this.logger.error(new Error(error));
        }
    }
    warn(message: string): void {
        this.logger.warn(message);
    }
    debug(message: string): void {
        this.logger.debug(message);
    }
}
