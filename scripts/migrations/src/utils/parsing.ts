import { existsSync } from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

const DEFAULT_SCHEMA = "public";

const zodSchema = z.object({
    schema: z
        .string()
        .default(DEFAULT_SCHEMA)
        .describe("Database schema name where migrations are applied"),
    migrationsFolder: z
        .string()
        .refine((value) => ["processing", "processing_cache"].includes(value), {
            message: "Invalid migrations folder",
        })
        .default("processing"),
});

export const parseArguments = (): z.infer<typeof zodSchema> => {
    return yargs(hideBin(process.argv))
        .option("schema", {
            alias: "s",
            type: "string",
            demandOption: true,
            description: "Database schema name where migrations are applied",
            default: DEFAULT_SCHEMA,
        })
        .options("migrationsFolder", {
            alias: "m",
            type: "string",
            choices: ["processing", "processing_cache"],
            demandOption: true,
            description: "Migrations folder",
            default: "processing",
        })
        .check((argv) => {
            zodSchema.parse(argv);
            return true;
        })
        .parseSync();
};

export const getMigrationsFolder = (type: string): string => {
    try {
        const migrationsFolder = path.join(
            path.dirname(new URL(import.meta.url).pathname),
            `../migrations/${type}`,
        );

        if (!existsSync(migrationsFolder)) {
            throw new Error(`Migrations folder not found`);
        }

        return migrationsFolder;
    } catch (error) {
        throw new Error(`Migrations folder not found`);
    }
};
