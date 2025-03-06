variable "region" {
}

variable "color" {
  description = "The color of the environment (blue or green)"
  validation {
    condition     = contains(["blue", "green"], var.color)
    error_message = "COLOR must be either 'blue' or 'green'"
  }
  type = string
}

variable "should_deploy_module" {
  description = "Whether the module should be deployed"
  type        = bool
}

variable "is_active_deployment" {
  description = "Whether the environment is active"
  type        = bool
}

variable "app_name" {
  description = "The name of the app"
}

variable "app_environment" {
  description = "The environment in which the app is running"
}

variable "public_subnets" {
  description = "The public subnets to deploy the application"
  type        = list(string)
}

variable "private_subnets" {
  description = "The private subnets to deploy the application"
  type        = list(string)
}


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

##########################
## Api service settings
##########################
variable "api_repository_url" {
  description = "The URL of the api image"
  type        = string
}

variable "api_image_tag" {
  description = "The tag of the api image"
  type        = string
}
variable "api_service_role_arn" {
  description = "The ARN of the api service role"
  type        = string
}
variable "api_security_group_id" {
  description = "The ID of the API security group"
  type        = string
}

variable "lb_target_group_arn" {
  description = "The ARN of the load balancer target group"
  type        = string
}




##########################
## Processing service settings
##########################
variable "processing_repository_url" {
  description = "The URL of the processing image"
  type        = string
}

variable "processing_image_tag" {
  description = "The tag of the processing image"
  type        = string
}

variable "processing_service_role_arn" {
  description = "The ARN of the processing service role"
  type        = string
}

variable "processing_security_group_id" {
  description = "The ID of the processing security group"
  type        = string
}

##########################
## Api environment variables
##########################
variable "DATALAYER_HASURA_DATABASE_URL" {
  description = "The URL of the datalayer hasura database"
  type        = string

}

variable "DATALAYER_HASURA_EXPOSED_PORT" {
  description = "The port of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_ENABLE_CONSOLE" {
  description = "The enable console of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_ADMIN_SECRET" {
  description = "The admin secret of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_UNAUTHORIZED_ROLE" {
  description = "The unauthorized role of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_CORS_DOMAIN" {
  description = "The cors domain of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_ENABLE_TELEMETRY" {
  description = "The enable telemetry of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_DEV_MODE" {
  description = "The dev mode of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_ADMIN_INTERNAL_ERRORS" {
  description = "The admin internal errors of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_CONSOLE_ASSETS_DIR" {
  description = "The console assets dir of the datalayer hasura"
  type        = string

}

variable "DATALAYER_HASURA_EXPERIMENTAL_FEATURES" {
  description = "The experimental features of the datalayer hasura"
  type        = string

}

variable "DATALAYER_HASURA_DEFAULT_NAMING_CONVENTION" {
  description = "The default naming convention of the datalayer hasura"
  type        = string

}

variable "DATALAYER_HASURA_BIGQUERY_STRING_NUMERIC_INPUT" {
  description = "The bigquery string numeric input of the datalayer hasura"
  type        = string

}

variable "DATALAYER_HASURA_ENABLED_LOG_TYPES" {
  description = "The enabled log types of the datalayer hasura"
  type        = string
}

variable "DATALAYER_HASURA_ENABLE_ALLOW_LIST" {
  description = "The enable allow list of the datalayer hasura"
  type        = string
}
##########################
## Processing environment variables
##########################
variable "CHAINS" {
  description = "Chains to be indexed"
  type = list(object({
    id           = string
    name         = string
    rpcUrls      = list(string)
    fetchLimit   = number
    fetchDelayMs = number
  }))
}


variable "DATABASE_URL" {
  description = "Postgres database URL"
  type        = string
}


variable "INDEXER_GRAPHQL_URL" {
  description = "Indexer GraphQL URL"
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
}

variable "COINGECKO_API_TYPE" {
  description = "Coingecko API type"
  type        = string
}

variable "LOG_LEVEL" {
  description = "Log level"
  type        = string
}
