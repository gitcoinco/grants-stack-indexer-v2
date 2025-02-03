import dotenv from "dotenv";
import { z } from "zod";

import { stringify } from "@grants-stack-indexer/shared";

dotenv.config();

const stringToJSONSchema = z.string().transform((str, ctx): z.infer<ReturnType<typeof Object>> => {
    try {
        return JSON.parse(str);
    } catch (e) {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
    }
});

const chainSchema = z.object({
    rpcUrls: z.array(z.string().url()).nonempty(),
    id: z.coerce.number().int().positive(),
    name: z.string(),
    fetchLimit: z.coerce.number().int().positive().default(500),
    fetchDelayMs: z.coerce.number().int().positive().default(1000),
});

const baseSchema = z.object({
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    CHAINS: stringToJSONSchema.pipe(z.array(chainSchema).nonempty()).refine((chains) => {
        const ids = chains.map((chain) => chain.id);
        const uniqueIds = new Set(ids);
        return ids.length === uniqueIds.size;
    }, "Chain IDs must be unique"),
    DATABASE_URL: z.string(),
    DATABASE_SCHEMA: z.string().default("public"),
    INDEXER_GRAPHQL_URL: z.string().url(),
    INDEXER_ADMIN_SECRET: z.string().optional(),
    PRICING_SOURCE: z.enum(["dummy", "coingecko"]).default("coingecko"),
    METADATA_SOURCE: z.enum(["dummy", "pinata", "public-gateway"]).default("dummy"),
    RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
    RETRY_BASE_DELAY_MS: z.coerce.number().int().min(1).default(3000), // 3 seconds
    RETRY_FACTOR: z.coerce.number().min(1).default(2),
    RETRY_MAX_DELAY_MS: z.coerce.number().int().min(1).optional(), // 5 minute
});

const dummyPricingSchema = baseSchema.extend({
    PRICING_SOURCE: z.literal("dummy"),
    DUMMY_PRICE: z.coerce.number().optional().default(1),
});

const coingeckoPricingSchema = baseSchema.extend({
    PRICING_SOURCE: z.literal("coingecko"),
    COINGECKO_API_KEY: z.string().min(1),
    COINGECKO_API_TYPE: z.enum(["demo", "pro"]).default("pro"),
});

const dummyMetadataSchema = baseSchema.extend({
    METADATA_SOURCE: z.literal("dummy"),
});

const pinataMetadataSchema = baseSchema.extend({
    METADATA_SOURCE: z.literal("pinata"),
    PINATA_JWT: z.string().min(1),
    PINATA_GATEWAY_URL: z.string().url(),
});

const publicGatewayMetadataSchema = baseSchema.extend({
    METADATA_SOURCE: z.literal("public-gateway"),
    PUBLIC_GATEWAY_URLS: stringToJSONSchema.pipe(z.array(z.string().url())),
});

const validationSchema = z
    .discriminatedUnion("PRICING_SOURCE", [dummyPricingSchema, coingeckoPricingSchema])
    .transform((val) => {
        if (val.PRICING_SOURCE === "dummy") {
            return { pricingSource: val.PRICING_SOURCE, dummyPrice: val.DUMMY_PRICE, ...val };
        }

        return {
            pricingSource: val.PRICING_SOURCE,
            apiKey: val.COINGECKO_API_KEY,
            apiType: val.COINGECKO_API_TYPE,
            ...val,
        };
    })
    .and(
        z
            .discriminatedUnion("METADATA_SOURCE", [
                dummyMetadataSchema,
                pinataMetadataSchema,
                publicGatewayMetadataSchema,
            ])
            .transform((val) => {
                if (val.METADATA_SOURCE === "dummy") {
                    return { metadataSource: val.METADATA_SOURCE, ...val };
                }
                if (val.METADATA_SOURCE === "pinata") {
                    return {
                        metadataSource: val.METADATA_SOURCE,
                        jwt: val.PINATA_JWT,
                        gateway: val.PINATA_GATEWAY_URL,
                        ...val,
                    };
                }
                if (val.METADATA_SOURCE === "public-gateway") {
                    return {
                        metadataSource: val.METADATA_SOURCE,
                        gateways: val.PUBLIC_GATEWAY_URLS,
                        ...val,
                    };
                }
                throw new Error("Invalid metadata source");
            }),
    );

const env = validationSchema.safeParse(process.env);

if (!env.success) {
    console.error(
        "Invalid environment variables:",
        env.error.issues.map((issue) => stringify(issue)).join("\n"),
    );
    process.exit(1);
}

export const environment = env.data;
export type Environment = z.infer<typeof validationSchema>;
