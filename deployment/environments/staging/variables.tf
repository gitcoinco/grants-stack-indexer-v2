################################################################
####################### DEPLOYMENT STATE #######################
################################################################

variable "DEPLOYMENT_STATE" {
  description = "Current deployment state (single, deploying)"
  type        = string
  validation {
    condition     = contains(["single", "deploying"], var.DEPLOYMENT_STATE)
    error_message = "DEPLOYMENT_STATE must be either 'single' or 'deploying'"
  }
}

variable "ACTIVE_DEPLOYMENT" {
  description = "Which environment is currently active (blue or green)"
  type        = string
  validation {
    condition     = contains(["blue", "green"], var.ACTIVE_DEPLOYMENT)
    error_message = "ACTIVE_DEPLOYMENT must be either 'blue' or 'green'"
  }
}


#########################################################
####################### SHARED ##########################
#########################################################

variable "AWS_REGION" {
  description = "The region of the application (BLUE)"
  type        = string
}

variable "APP_NAME" {
  description = "The name of the app (BLUE or GREEN)"
  type        = string
}

variable "APP_ENVIRONMENT" {
  description = "The environment in which the app is running (BLUE or GREEN)"
  type        = string
}

variable "DATALAYER_PG_PASSWORD" {
  description = "Datalayer postgres password (BLUE or GREEN)"
  type        = string
  sensitive   = true
}

variable "DATALAYER_PG_USER" {
  description = "Datalayer postgres user (BLUE or GREEN)"
  type        = string
  sensitive   = true
}
#########################################################
####################### GLOBALS ##########################
#########################################################

### BLUE Variables
variable "BLUE_PROCESSING_IMAGE_TAG" {
  description = "Processing image tag (BLUE)"
  type        = string
}

variable "BLUE_API_REPOSITORY_URL" {
  description = "API repository URL (BLUE)"
  type        = string
}

variable "BLUE_API_IMAGE_TAG" {
  description = "API image tag (BLUE)"
  type        = string
}

### GREEN Variables

variable "GREEN_PROCESSING_IMAGE_TAG" {
  description = "Processing image tag (GREEN)"
  type        = string
}

variable "GREEN_API_REPOSITORY_URL" {
  description = "API repository URL (GREEN)"
  type        = string
}

variable "GREEN_API_IMAGE_TAG" {
  description = "API image tag (GREEN)"
  type        = string
}

#########################################################
####################### PROCESSING ######################
#########################################################

### BLUE Variables
variable "BLUE_NODE_ENV" {
  description = "Node environment (BLUE)"
  type        = string
}

variable "BLUE_RETRY_MAX_ATTEMPTS" {
  description = "Retry max attempts (BLUE)"
  type        = string
}

variable "BLUE_RETRY_BASE_DELAY_MS" {
  description = "Retry base delay in milliseconds (BLUE)"
  type        = string
}

variable "BLUE_RETRY_MAX_DELAY_MS" {
  description = "Retry max delay in milliseconds (BLUE)"
  type        = string
}

variable "BLUE_RETRY_FACTOR" {
  description = "Retry factor (BLUE)"
  type        = string
}

variable "BLUE_CHAINS" {
  description = "Chains to be indexed (BLUE)"
  type = list(object({
    id           = number
    name         = string
    rpcUrls      = list(string)
    fetchLimit   = number
    fetchDelayMs = number
  }))
  sensitive = false
}

variable "BLUE_INDEXER_GRAPHQL_URL" {
  description = "Indexer GraphQL URL (BLUE)"
  default     = "http://localhost:8080/v1/graphql"
  type        = string
}

# variable "BLUE_INDEXER_ADMIN_SECRET" { ... }

variable "BLUE_METADATA_SOURCE" {
  description = "Metadata source (BLUE)"
  type        = string
}

variable "BLUE_PUBLIC_GATEWAY_URLS" {
  description = "Public gateway URLs (BLUE)"
  type        = list(string)
}

variable "BLUE_PRICING_SOURCE" {
  description = "Pricing source (BLUE)"
  type        = string
}

variable "BLUE_COINGECKO_API_KEY" {
  description = "Coingecko API key (BLUE)"
  type        = string
  sensitive   = true
}

variable "BLUE_COINGECKO_API_TYPE" {
  description = "Coingecko API type (BLUE)"
  default     = "pro"
  type        = string
}

variable "BLUE_LOG_LEVEL" {
  description = "Log level (BLUE)"
  default     = "info"
  type        = string
}


### GREEN Variables
variable "GREEN_NODE_ENV" {
  description = "Node environment (GREEN)"
  type        = string
}

variable "GREEN_RETRY_MAX_ATTEMPTS" {
  description = "Retry max attempts (GREEN)"
  type        = string
}

variable "GREEN_RETRY_BASE_DELAY_MS" {
  description = "Retry base delay in milliseconds (GREEN)"
  type        = string
}

variable "GREEN_RETRY_MAX_DELAY_MS" {
  description = "Retry max delay in milliseconds (GREEN)"
  type        = string
}

variable "GREEN_RETRY_FACTOR" {
  description = "Retry factor (GREEN)"
  type        = string
}

variable "GREEN_CHAINS" {
  description = "Chains to be indexed (GREEN)"
  type = list(object({
    id           = number
    name         = string
    rpcUrls      = list(string)
    fetchLimit   = number
    fetchDelayMs = number
  }))
  sensitive = false
}
variable "GREEN_INDEXER_GRAPHQL_URL" {
  description = "Indexer GraphQL URL (GREEN)"
  default     = "http://localhost:8080/v1/graphql"
  type        = string
}

variable "GREEN_METADATA_SOURCE" {
  description = "Metadata source (GREEN)"
  type        = string
}

variable "GREEN_PUBLIC_GATEWAY_URLS" {
  description = "Public gateway URLs (GREEN)"
  type        = list(string)
}

variable "GREEN_PRICING_SOURCE" {
  description = "Pricing source (GREEN)"
  type        = string
}

variable "GREEN_COINGECKO_API_KEY" {
  description = "Coingecko API key (GREEN)"
  type        = string
  sensitive   = true
}

variable "GREEN_COINGECKO_API_TYPE" {
  description = "Coingecko API type (GREEN)"
  default     = "pro"
  type        = string
}

variable "GREEN_LOG_LEVEL" {
  description = "Log level (GREEN)"
  default     = "info"
  type        = string
}

#########################################################
################### DATALAYER POSTGRES ##################
#########################################################
### BLUE Variables
variable "BLUE_DATALAYER_PG_DB_NAME" {
  description = "Database name (BLUE)"
  type        = string
  sensitive   = true
}

### GREEN Variables
variable "GREEN_DATALAYER_PG_DB_NAME" {
  description = "Database name (GREEN)"
  type        = string
  sensitive   = true
}

#########################################################
############## DATALAYER HASURA API #####################
#########################################################

### BLUE Variables
variable "BLUE_DATALAYER_HASURA_EXPOSED_PORT" {
  description = "Datalayer hasura exposed port (BLUE)"
  type        = string
  default     = "8080"
}

variable "BLUE_DATALAYER_HASURA_ENABLE_CONSOLE" {
  description = "Datalayer hasura enable console (BLUE)"
  type        = string
  default     = "true"
}

variable "BLUE_DATALAYER_HASURA_ADMIN_SECRET" {
  description = "Datalayer hasura admin secret (BLUE)"
  type        = string
  sensitive   = true
}

variable "BLUE_DATALAYER_HASURA_UNAUTHORIZED_ROLE" {
  description = "Datalayer hasura unauthorized role (BLUE)"
  type        = string
  default     = "public"
}

variable "BLUE_DATALAYER_HASURA_CORS_DOMAIN" {
  description = "Datalayer hasura cors domain (BLUE)"
  type        = string
  default     = "*"
}

variable "BLUE_DATALAYER_HASURA_CONSOLE_ASSETS_DIR" {
  description = "Datalayer hasura console assets dir (BLUE)"
  type        = string
  default     = "null"
}

variable "BLUE_DATALAYER_HASURA_ENABLE_TELEMETRY" {
  description = "Datalayer hasura enable telemetry (BLUE)"
  type        = string
  default     = "false"
}

variable "BLUE_DATALAYER_HASURA_DEV_MODE" {
  description = "Datalayer hasura dev mode (BLUE)"
  type        = string
  default     = "false"
}

variable "BLUE_DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS" {
  description = "Datalayer hasura admin internal errors (BLUE)"
  type        = string
  default     = "false"
}

variable "BLUE_DATALAYER_HASURA_ENABLED_LOG_TYPES" {
  description = "Datalayer hasura enabled log types (BLUE)"
  type        = string
  default     = "startup, http-log, webhook-log, websocket-log, query-log"
}

variable "BLUE_DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION" {
  description = "Datalayer hasura default naming convention (BLUE)"
  type        = string
  default     = "graphql-default"
}

variable "BLUE_DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT" {
  description = "Datalayer hasura bigquery string numeric input (BLUE)"
  type        = string
  default     = "true"
}

variable "BLUE_DATALAYER_HASURA_EXPERIMENTAL_FEATURES" {
  description = "Datalayer hasura experimental features (BLUE)"
  type        = string
  default     = "bigquery_string_numeric_input,naming_convention"
}

variable "BLUE_DATALAYER_HASURA_ENABLE_ALLOW_LIST" {
  description = "Datalayer hasura enable allow list (BLUE)"
  type        = string
  default     = "true"
}

### GREEN Variables
variable "GREEN_DATALAYER_HASURA_EXPOSED_PORT" {
  description = "Datalayer hasura exposed port (GREEN)"
  type        = string
  default     = "8080"
}

variable "GREEN_DATALAYER_HASURA_ENABLE_CONSOLE" {
  description = "Datalayer hasura enable console (GREEN)"
  type        = string
  default     = "true"
}

variable "GREEN_DATALAYER_HASURA_ADMIN_SECRET" {
  description = "Datalayer hasura admin secret (GREEN)"
  type        = string
  sensitive   = true
}

variable "GREEN_DATALAYER_HASURA_UNAUTHORIZED_ROLE" {
  description = "Datalayer hasura unauthorized role (GREEN)"
  type        = string
  default     = "public"
}

variable "GREEN_DATALAYER_HASURA_CORS_DOMAIN" {
  description = "Datalayer hasura cors domain (GREEN)"
  type        = string
  default     = "*"
}

variable "GREEN_DATALAYER_HASURA_CONSOLE_ASSETS_DIR" {
  description = "Datalayer hasura console assets dir (GREEN)"
  type        = string
  default     = "null"
}

variable "GREEN_DATALAYER_HASURA_ENABLE_TELEMETRY" {
  description = "Datalayer hasura enable telemetry (GREEN)"
  type        = string
  default     = "false"
}

variable "GREEN_DATALAYER_HASURA_DEV_MODE" {
  description = "Datalayer hasura dev mode (GREEN)"
  type        = string
  default     = "false"
}

variable "GREEN_DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS" {
  description = "Datalayer hasura admin internal errors (GREEN)"
  type        = string
  default     = "false"
}

variable "GREEN_DATALAYER_HASURA_ENABLED_LOG_TYPES" {
  description = "Datalayer hasura enabled log types (GREEN)"
  type        = string
  default     = "startup, http-log, webhook-log, websocket-log, query-log"
}

variable "GREEN_DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION" {
  description = "Datalayer hasura default naming convention (GREEN)"
  type        = string
  default     = "graphql-default"
}

variable "GREEN_DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT" {
  description = "Datalayer hasura bigquery string numeric input (GREEN)"
  type        = string
  default     = "true"
}

variable "GREEN_DATALAYER_HASURA_EXPERIMENTAL_FEATURES" {
  description = "Datalayer hasura experimental features (GREEN)"
  type        = string
  default     = "bigquery_string_numeric_input,naming_convention"
}

variable "GREEN_DATALAYER_HASURA_ENABLE_ALLOW_LIST" {
  description = "Datalayer hasura enable allow list (GREEN)"
  type        = string
  default     = "true"
}
