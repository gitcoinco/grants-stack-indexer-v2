import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        testTimeout: 300_000, // 5 minutes timeout for integration tests
        hookTimeout: 300_000,
        include: ["test/**/*.spec-e2e.ts"],
        exclude: ["node_modules", "dist"], // Exclude certain directories
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules", "dist", ...configDefaults.exclude], // Files to exclude from coverage
        },
        globalSetup: "./test/globalSetup.ts",
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
