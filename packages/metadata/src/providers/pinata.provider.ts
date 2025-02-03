import { PinataSDK } from "pinata";

import { ILogger } from "@grants-stack-indexer/shared";

import type { IMetadataProvider } from "../internal.js";
import { isValidCid } from "../internal.js";

export class PinataProvider implements IMetadataProvider {
    private readonly pinataClient: PinataSDK;

    constructor(
        readonly pinataJwt: string,
        readonly pinataGateway: string,
        private readonly logger: ILogger,
    ) {
        // console.log("pinataJwt", this.pinataJwt);
        // console.log("pinataGateway", this.pinataGateway);
        this.pinataClient = new PinataSDK({
            pinataJwt: this.pinataJwt,
            pinataGateway: this.pinataGateway,
        });
    }

    /* @inheritdoc */
    async getMetadata<T>(ipfsCid: string): Promise<T | undefined> {
        try {
            if (ipfsCid === "" || !isValidCid(ipfsCid)) {
                return undefined;
            }
            // console.log("ipfsCid", ipfsCid);
            // console.log("pinataClient", this.pinataClient.gateways);
            const pinataResponse = await this.pinataClient.gateways.get(ipfsCid);
            if (!pinataResponse.data) {
                return undefined;
            }
            // console.log("pinataResponse", pinataResponse);
            this.logger.debug("Fetch metadata from pinata", {
                ipfsCid,
                pinataResponse,
            });
            return pinataResponse.data as T;
        } catch (error) {
            this.logger.error("Error fetching metadata from pinata", {
                ipfsCid,
                error,
            });
            return undefined;
        }
    }
}
