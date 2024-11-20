import { z } from "zod";

const dbEnvSchema = z.object({
    DATABASE_URL: z.string().url(),
    DATABASE_SCHEMA: z.string().min(1),
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
