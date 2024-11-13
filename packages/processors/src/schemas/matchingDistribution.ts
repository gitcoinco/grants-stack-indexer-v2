import { z } from "zod";

export type MatchingDistribution = z.infer<typeof MatchingDistributionSchema>;

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
            matchPoolPercentage: z.number().or(z.string().min(1)).pipe(z.coerce.number()),
            contributionsCount: z.number().or(z.string().min(1)).pipe(z.coerce.number()),
            originalMatchAmountInToken: BigIntSchema.default("0"),
            matchAmountInToken: BigIntSchema.default("0"),
        }),
    ),
});
