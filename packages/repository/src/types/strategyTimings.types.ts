export type StrategyTimings = {
    address: string;
    strategyId: string;
    timings: unknown;
    createdAt: Date;
};

export type NewStrategyTimings = Omit<StrategyTimings, "createdAt">;
export type PartialStrategyTimings = Partial<StrategyTimings>;
