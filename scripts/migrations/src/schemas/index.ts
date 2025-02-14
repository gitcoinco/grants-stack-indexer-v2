import { z } from "zod";

const dbEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

export type DbEnvConfig = z.infer<typeof dbEnvSchema>;

export function getDatabaseConfigFromEnv(): DbEnvConfig {
    const result = dbEnvSchema.safeParse(process.env);

    if (!result.success) {
        console.error("❌ Invalid environment variables:", result.error.format());
        throw new Error("Invalid environment variables");
    }

    return result.data;
}
