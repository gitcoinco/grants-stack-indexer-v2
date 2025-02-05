import { configDotenv } from "dotenv";
import { z } from "zod";

configDotenv();

const stringToJSONSchema = z.string().transform((str, ctx): z.infer<ReturnType<typeof Object>> => {
    try {
        return JSON.parse(str);
    } catch (e) {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
    }
});

const dbEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    INDEXER_URL: z.string().url(),
    INDEXER_SECRET: z.string().optional(),
    INDEXER_FETCH_LIMIT: z.coerce.number().optional().default(1000),
    PUBLIC_GATEWAY_URLS: stringToJSONSchema.pipe(z.array(z.string().url())),
    CHAIN_IDS: stringToJSONSchema.pipe(z.array(z.number())),
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    PRICING_SOURCE: z.enum(["dummy", "coingecko"]).default("coingecko"),
});

const dummyPricingSchema = dbEnvSchema.extend({
    PRICING_SOURCE: z.literal("dummy"),
    DUMMY_PRICE: z.coerce.number().optional().default(1),
});

const coingeckoPricingSchema = dbEnvSchema.extend({
    PRICING_SOURCE: z.literal("coingecko"),
    COINGECKO_API_KEY: z.string().min(1),
    COINGECKO_API_TYPE: z.enum(["demo", "pro"]).default("pro"),
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
    });

const env = validationSchema.safeParse(process.env);

export type DbEnvConfig = z.infer<typeof dbEnvSchema>;

/**
 * Retrieves the validated database configuration from environment variables.
 *
 * This function uses the `dbEnvSchema` to safely parse and validate the environment variables
 * provided in `process.env`. If the validation fails, it logs a detailed error message and throws
 * an exception to halt further execution. On successful validation, it returns the configuration
 * structured as defined by `DbEnvConfig`.
 *
 * @returns The validated database configuration.
 * @throws Error when the environment variables do not conform to the expected schema.
 */
export function getDatabaseConfigFromEnv(): DbEnvConfig {
    const result = dbEnvSchema.safeParse(process.env);

    if (!result.success) {
        console.error("❌ Invalid environment variables:", result.error.format());
        throw new Error("Invalid environment variables");
    }

    return result.data;
}

/**
 * Retrieves validated environment variables.
 *
 * This function checks whether the environment variables have been successfully validated using `validationSchema`.
 * If the validation fails, it logs the formatted error details and throws an exception to prevent further execution
 * with invalid configurations. On successful validation, it returns the structured environment settings.
 *
 * @returns The validated environment variables conforming to `validationSchema`.
 * @throws Error if the environment variables do not pass validation.
 */
export function getEnv(): z.infer<typeof validationSchema> {
    if (!env.success) {
        console.error("❌ Invalid environment variables:", env.error.format());
        throw new Error("Invalid environment variables");
    }

    return env.data;
}
