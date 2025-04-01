/**
 * Generic logger interface.
 */
export interface ILogger {
    error: (error: Error | string, context?: Record<string, unknown>) => void;
    info: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
    verbose: (message: string, context?: Record<string, unknown>) => void;
}
