import fs from "fs";
import path from "path";

interface PerformanceMetric {
    timestamp: string;
    eventType: string;
    operation: string;
    duration: number;
    totalTime: number;
    blockNumber?: number;
    transactionHash?: string;
    chainId?: number;
    roundId?: string;
    applicationId?: string;
    donorAddress?: string;
    recipientAddress?: string;
    amount?: string;
    amountInUsd?: string;
    uniqueDonorsCount?: number;
    totalDonationsCount?: number;
    details?: Record<string, any>;
}

export class PerformanceLogger {
    private static instance: PerformanceLogger;
    private csvPath: string;
    private readonly THRESHOLD_MS = 500; // 0.5 seconds

    private constructor() {
        const logsDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        this.csvPath = path.join(logsDir, "performance-metrics.csv");
        this.initializeCsvFile();
    }

    public static getInstance(): PerformanceLogger {
        if (!PerformanceLogger.instance) {
            PerformanceLogger.instance = new PerformanceLogger();
        }
        return PerformanceLogger.instance;
    }

    private initializeCsvFile(): void {
        if (!fs.existsSync(this.csvPath)) {
            const header =
                [
                    "timestamp",
                    "eventType",
                    "operation",
                    "duration",
                    "totalTime",
                    "blockNumber",
                    "transactionHash",
                    "chainId",
                    "roundId",
                    "applicationId",
                    "donorAddress",
                    "recipientAddress",
                    "amount",
                    "amountInUsd",
                    "uniqueDonorsCount",
                    "totalDonationsCount",
                    "details",
                ].join(",") + "\n";
            fs.writeFileSync(this.csvPath, header);
        }
    }

    public logMetric(metric: PerformanceMetric): void {
        if (metric.totalTime >= this.THRESHOLD_MS) {
            const row =
                [
                    metric.timestamp,
                    metric.eventType,
                    metric.operation,
                    metric.duration.toFixed(2),
                    metric.totalTime.toFixed(2),
                    metric.blockNumber || "",
                    metric.transactionHash || "",
                    metric.chainId || "",
                    metric.roundId || "",
                    metric.applicationId || "",
                    metric.donorAddress || "",
                    metric.recipientAddress || "",
                    metric.amount || "",
                    metric.amountInUsd || "",
                    metric.uniqueDonorsCount || "",
                    metric.totalDonationsCount || "",
                    JSON.stringify(metric.details || {}),
                ].join(",") + "\n";

            fs.appendFileSync(this.csvPath, row);
        }
    }
}

export const performanceLogger = PerformanceLogger.getInstance();
