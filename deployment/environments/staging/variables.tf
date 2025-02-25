variable "region" {
  default = "us-east-2"
}

variable "app_name" {
  description = "The name of the app"
}

variable "app_environment" {
  description = "The environment in which the app is running"
}

variable "processing_image_tag" {
  description = "Processing image tag"
  type        = string
}

variable "api_repository_url" {
  description = "API repository URL"
  type        = string
}

variable "api_image_tag" {
  description = "API image tag"
  type        = string
}

#########################################################
######################### PROCESSING ####################
#########################################################
variable "NODE_ENV" {
  description = "Node environment"
  type        = string
}

variable "RETRY_MAX_ATTEMPTS" {
  description = "Retry max attempts"
  type        = string
}

variable "RETRY_BASE_DELAY_MS" {
  description = "Retry base delay in milliseconds"
  type        = string
}

variable "RETRY_MAX_DELAY_MS" {
  description = "Retry max delay in milliseconds"
  type        = string
}

variable "RETRY_FACTOR" {
  description = "Retry factor"
  type        = string
}

variable "CHAINS" {
  description = "Chains to be indexed"
  type = list(object({
    id           = number
    name         = string
    rpcUrls      = list(string)
    fetchLimit   = number
    fetchDelayMs = number
  }))
  sensitive = true
}




variable "INDEXER_GRAPHQL_URL" {
  description = "Indexer GraphQL URL"
  default     = "http://localhost:8080/v1/graphql"
  type        = string
}

# variable "INDEXER_ADMIN_SECRET" {
#   description = "Indexer admin secret"
#   type        = string
# }

variable "METADATA_SOURCE" {
  description = "Metadata source"
  type        = string
}

variable "PUBLIC_GATEWAY_URLS" {
  description = "Public gateway URLs"
  type        = list(string)
}

variable "PRICING_SOURCE" {
  description = "Pricing source"
  type        = string
}

variable "COINGECKO_API_KEY" {
  description = "Coingecko API key"
  type        = string
  sensitive   = true
}

variable "COINGECKO_API_TYPE" {
  description = "Coingecko API type"
  default     = "pro"
  type        = string
}

variable "LOG_LEVEL" {
  description = "Log level"
  default     = "info"
  type        = string
}


######################################################
############### DATALAYER POSTGRES ###################
######################################################
variable "DATALAYER_PG_PASSWORD" {
  description = "Datalayer postgres password"
  type        = string
  sensitive   = true
}

variable "DATALAYER_PG_USER" {
  description = "Datalayer postgres user"
  type        = string
  sensitive   = true
}

variable "DATALAYER_PG_EXPOSED_PORT" {
  description = "Datalayer postgres exposed port"
  type        = string
}

variable "DATALAYER_PG_DB_NAME" {
  description = "Database name"
  type        = string
  sensitive   = true
}

######################################################
############### DATALAYER HASURA API #################
######################################################
variable "DATALAYER_HASURA_EXPOSED_PORT" {
  description = "Datalayer hasura exposed port"
  type        = string
}

variable "DATALAYER_HASURA_ENABLE_CONSOLE" {
  description = "Datalayer hasura enable console"
  type        = string
}

variable "DATALAYER_HASURA_ADMIN_SECRET" {
  description = "Datalayer hasura admin secret"
  type        = string
  sensitive   = true
}

variable "DATALAYER_HASURA_UNAUTHORIZED_ROLE" {
  description = "Datalayer hasura unauthorized role"
  type        = string
}

variable "DATALAYER_HASURA_CORS_DOMAIN" {
  description = "Datalayer hasura cors domain"
  type        = string
}

variable "DATALAYER_HASURA_CONSOLE_ASSETS_DIR" {
  description = "Datalayer hasura console assets dir"
  type        = string
}

variable "DATALAYER_HASURA_ENABLE_TELEMETRY" {
  description = "Datalayer hasura enable telemetry"
  type        = string
}

variable "DATALAYER_HASURA_DEV_MODE" {
  description = "Datalayer hasura dev mode"
  type        = string
}

variable "DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS" {
  description = "Datalayer hasura admin internal errors"
  type        = string
}

variable "DATALAYER_HASURA_ENABLED_LOG_TYPES" {
  description = "Datalayer hasura enabled log types"
  type        = string
}

variable "DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION" {
  description = "Datalayer hasura default naming convention"
  type        = string
}

variable "DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT" {
  description = "Datalayer hasura bigquery string numeric input"
  type        = string
}

variable "DATALAYER_HASURA_EXPERIMENTAL_FEATURES" {
  description = "Datalayer hasura experimental features"
  type        = string
}
variable "DATALAYER_HASURA_ENABLE_ALLOW_LIST" {
  description = "Datalayer hasura enable allow list"
  type        = string
}
