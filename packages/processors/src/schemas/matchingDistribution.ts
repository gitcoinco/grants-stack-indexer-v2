import { z } from "zod";

export type MatchingDistribution = z.infer<typeof MatchingDistributionSchema>;
export type SimpleMatchingDistribution = z.infer<typeof SimpleMatchingDistributionSchema>;

const BigIntSchema = z.string().or(
    z.object({ type: z.literal("BigNumber"), hex: z.string() }).transform((val) => {
        return BigInt(val.hex).toString();
    }),
);

export const MatchingDistributionSchema = z.object({
    matchingDistribution: z.array(
        z.object({
            applicationId: z.string(),
            projectPayoutAddress: z.string(),
            projectId: z.string(),
            projectName: z.string(),
            matchPoolPercentage: z.coerce.number(),
            contributionsCount: z.coerce.number(),
            originalMatchAmountInToken: BigIntSchema.default("0"),
            matchAmountInToken: BigIntSchema.default("0"),
        }),
    ),
});

export const SimpleMatchingDistributionSchema = z.array(
    z.object({
        anchorAddress: z.string(),
        payoutAddress: z.string(),
        amount: BigIntSchema.default("0"),
        index: z.coerce.number(),
    }),
);
