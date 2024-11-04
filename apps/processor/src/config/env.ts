import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const stringToJSONSchema = z.string().transform((str, ctx): z.infer<ReturnType<typeof Object>> => {
    try {
        return JSON.parse(str);
    } catch (e) {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
    }
});

const validationSchema = z.object({
    RPC_URLS: stringToJSONSchema.pipe(z.array(z.string().url())),
    CHAIN_ID: z.coerce.number().int().positive(),
    FETCH_LIMIT: z.coerce.number().int().positive().default(1000),
    FETCH_DELAY_MS: z.coerce.number().int().positive().default(10000),
    DATABASE_URL: z.string(),
    DATABASE_SCHEMA: z.string().default("public"),
    INDEXER_GRAPHQL_URL: z.string().url(),
    INDEXER_ADMIN_SECRET: z.string(),
    COINGECKO_API_KEY: z.string(),
    COINGECKO_API_TYPE: z.enum(["demo", "pro"]).default("demo"),
    IPFS_GATEWAYS_URL: stringToJSONSchema
        .pipe(z.array(z.string().url()))
        .default('["https://ipfs.io"]'),
});

const env = validationSchema.safeParse(process.env);

if (!env.success) {
    console.error(
        "Invalid environment variables:",
        env.error.issues.map((issue) => JSON.stringify(issue)).join("\n"),
    );
    process.exit(1);
}

export const environment = env.data;
export type Environment = z.infer<typeof validationSchema>;
