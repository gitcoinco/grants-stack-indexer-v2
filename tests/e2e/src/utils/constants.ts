/**
 * Base Node.js environment variables required for running commands
 */
export const BASE_NODE_ENV_VARS = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE: process.env.NODE,
    npm_config_prefix: process.env.npm_config_prefix,
    PNPM_HOME: process.env.PNPM_HOME,
    npm_config_user_agent: process.env.npm_config_user_agent,
};

export const DATABASE_SCHEMA = "public";
export const MOCK_ENVIO_INDEXER_PORT = 4000;
