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
        if (gateways.length === 0) {
            throw new EmptyGatewaysUrlsException();
        }

        this.gateways = gateways;
        this.axiosInstance = axios.create({ timeout: 3000 });
    }
    /* @inheritdoc */
    async getMetadata<T>(
        ipfsCid: string,
        validateContent?: z.ZodSchema<T>,
    ): Promise<T | undefined | null> {
        if (ipfsCid === "" || !isValidCid(ipfsCid)) {
            return undefined;
        }
        for (let i = 0; i < this.gateways.length; i++) {
            const gateway = this.gateways[i];
            const url = `${gateway}/ipfs/${ipfsCid}`;
            try {
                //TODO: retry policy for each gateway
                this.logger.debug("Fetching metadata from gateway", {
                    gateway,
                    url,
                });
                const { data } = await this.axiosInstance.get<T>(url);

                if (typeof data !== "object" && !isJSON(data)) {
                    this.logger.error(`Invalid JSON: ${JSON.stringify(data, undefined, 4)}`);
                    throw new InvalidContentException("Invalid JSON");
                }

                return this.validateData(data, validateContent);
            } catch (error: unknown) {
                if (error instanceof InvalidContentException) throw error;

                if (axios.isAxiosError(error)) {
                    this.logger.warn(`Failed to fetch from ${url}: ${error.message}`);
                } else {
                    this.logger.error(`Failed to fetch from ${url}: ${error}`);
                }
            }
        }
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
        if (validateContent) {
            const parsedData = validateContent.safeParse(data);
            if (parsedData.success) {
                return parsedData.data;
            } else {
                throw new InvalidContentException(
                    parsedData.error.issues.map((issue) => stringify(issue)).join("\n"),
                );
            }
        }

        return data;
    }
}
