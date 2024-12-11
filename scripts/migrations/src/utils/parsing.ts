import { existsSync } from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

const zodSchema = z.object({
    folder: z
        .string()
        .refine((value) => ["chainData", "registries"].includes(value), {
            message: "Schema name must be either 'chainData' or 'registries'",
        })
        .describe("Folder name to migrate"),
    schema: z.string().describe("Database schema name where migrations are applied"),
});

export const parseArguments = (): z.infer<typeof zodSchema> => {
    return yargs(hideBin(process.argv))
        .option("folder", {
            type: "string",
            demandOption: true,
            description: "Folder name to migrate",
        })
        .option("schema", {
            alias: "s",
            type: "string",
            demandOption: true,
            description: "Database schema name where migrations are applied",
        })
        .check((argv) => {
            zodSchema.parse(argv);
            return true;
        })
        .parseSync();
};

export const getMigrationsFolder = (folder: string): string => {
    const migrationsFolder = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        `../migrations/${folder}`,
    );
    console.log("migrationsFolder", migrationsFolder);

    if (!existsSync(migrationsFolder)) {
        throw new Error(`Migrations folder '${folder}' not found`);
    }

    return migrationsFolder;
};
