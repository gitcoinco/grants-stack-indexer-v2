import axios, { AxiosInstance } from "axios";
import { z } from "zod";

import { ILogger, isJSON, stringify } from "@grants-stack-indexer/shared";

import type { IMetadataProvider } from "../internal.js";
import { EmptyGatewaysUrlsException, InvalidContentException, isValidCid } from "../internal.js";

export class PublicGatewayProvider implements IMetadataProvider {
    private readonly axiosInstance: AxiosInstance;
    constructor(
        private readonly gateways: string[],
        private readonly logger: ILogger,
    ) {
        this.logger.debug("Initializing PublicGatewayProvider", {
            className: "PublicGatewayProvider",
            gatewayCount: gateways.length,
            gateways,
        });

        if (gateways.length === 0) {
            this.logger.error("No gateways provided", {
                className: "PublicGatewayProvider",
            });
            throw new EmptyGatewaysUrlsException();
        }

        this.gateways = gateways;
        this.axiosInstance = axios.create({ timeout: 3000 });
    }
    /* @inheritdoc */
    async getMetadata<T>(
        ipfsCid: string,
        validateContent?: z.ZodSchema<T>,
    ): Promise<T | undefined> {
        this.logger.debug("Getting metadata", {
            className: "PublicGatewayProvider",
            methodName: "getMetadata",
            ipfsCid,
            hasValidator: !!validateContent,
        });

        if (ipfsCid === "" || !isValidCid(ipfsCid)) {
            this.logger.warn("Invalid IPFS CID", {
                className: "PublicGatewayProvider",
                methodName: "getMetadata",
                ipfsCid,
                isEmptyCid: ipfsCid === "",
                isValidCid: isValidCid(ipfsCid),
            });
            return undefined;
        }

        for (let i = 0; i < this.gateways.length; i++) {
            const gateway = this.gateways[i];
            const url = `${gateway}/ipfs/${ipfsCid}`;

            this.logger.debug("Attempting gateway fetch", {
                className: "PublicGatewayProvider",
                methodName: "getMetadata",
                gatewayIndex: i + 1,
                totalGateways: this.gateways.length,
                gateway,
                url,
            });

            try {
                const startTime = Date.now();
                const { data } = await this.axiosInstance.get<T>(url);
                const duration = Date.now() - startTime;

                this.logger.debug("Gateway response received", {
                    className: "PublicGatewayProvider",
                    methodName: "getMetadata",
                    gateway,
                    responseTimeMs: duration,
                    dataSize: JSON.stringify(data).length,
                });

                if (typeof data !== "object" && !isJSON(data)) {
                    this.logger.error("Invalid JSON response", {
                        className: "PublicGatewayProvider",
                        methodName: "getMetadata",
                        gateway,
                        url,
                        data: JSON.stringify(data, undefined, 4),
                    });
                    throw new InvalidContentException("Invalid JSON");
                }

                this.logger.debug("Validating response data", {
                    className: "PublicGatewayProvider",
                    methodName: "getMetadata",
                    gateway,
                    hasValidator: !!validateContent,
                });

                const validatedData = this.validateData(data, validateContent);

                this.logger.info("Successfully retrieved and validated metadata", {
                    className: "PublicGatewayProvider",
                    methodName: "getMetadata",
                    gateway,
                    ipfsCid,
                    responseTimeMs: duration,
                });

                return validatedData;
            } catch (error: unknown) {
                if (error instanceof InvalidContentException) {
                    this.logger.error("Content validation failed", {
                        className: "PublicGatewayProvider",
                        methodName: "getMetadata",
                        gateway,
                        url,
                        error: error.message,
                    });
                    throw error;
                }

                if (axios.isAxiosError(error)) {
                    this.logger.warn("Gateway request failed", {
                        className: "PublicGatewayProvider",
                        methodName: "getMetadata",
                        gateway,
                        url,
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        error: error.message,
                    });
                } else {
                    this.logger.error("Unexpected error during fetch", {
                        className: "PublicGatewayProvider",
                        methodName: "getMetadata",
                        gateway,
                        url,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        this.logger.warn("All gateways failed", {
            className: "PublicGatewayProvider",
            methodName: "getMetadata",
            ipfsCid,
            attemptedGateways: this.gateways,
        });
        return undefined;
    }

    /**
     * Validates the data using the provided schema.
     *
     * @param data - The data to validate.
     * @param validateContent (optional) - The schema to validate the data against.
     * @returns The validated data.
     * @throws InvalidContentException if the data does not match the schema.
     */
    private validateData<T>(data: T, validateContent?: z.ZodSchema<T>): T {
        this.logger.debug("Validating data", {
            className: "PublicGatewayProvider",
            methodName: "validateData",
            hasValidator: !!validateContent,
        });

        if (validateContent) {
            const parsedData = validateContent.safeParse(data);
            if (parsedData.success) {
                this.logger.debug("Data validation successful", {
                    className: "PublicGatewayProvider",
                    methodName: "validateData",
                });
                return parsedData.data;
            } else {
                const issues = parsedData.error.issues.map((issue) => stringify(issue)).join("\n");
                this.logger.error("Data validation failed", {
                    className: "PublicGatewayProvider",
                    methodName: "validateData",
                    validationIssues: issues,
                });
                throw new InvalidContentException(issues);
            }
        }

        return data;
    }
}
