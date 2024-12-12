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
        .check((argv) => {
            zodSchema.parse(argv);
            return true;
        })
        .parseSync();
};

export const getMigrationsFolder = (): string => {
    const migrationsFolder = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        `../migrations`,
    );

    if (!existsSync(migrationsFolder)) {
        throw new Error(`Migrations folder not found`);
    }

    return migrationsFolder;
};
