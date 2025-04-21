import { getAddress } from "viem";

import { Changeset, Donation } from "@grants-stack-indexer/repository";
import { ChainId, getTokenOrThrow, ProcessorEvent } from "@grants-stack-indexer/shared";

import { getTokenAmountInUsd, getUsdInTokenAmount } from "../../../../helpers/index.js";
import {
    IEventHandler,
    MetadataParsingFailed,
    ProcessorDependencies,
} from "../../../../internal.js";
import { ApplicationMetadata, ApplicationMetadataSchema } from "../../../../schemas/index.js";
import { getDonationId } from "../../helpers/index.js";

type Dependencies = Pick<
    ProcessorDependencies,
    "roundRepository" | "applicationRepository" | "pricingProvider"
>;

/**
 * Handles the Allocated event for the Donation Voting Merkle Distribution Direct Transfer strategy.
 *
 * This handler performs the following core actions when a donation is allocated to a project:
 * - Validates that both the round and application exist
 * - Retrieves token price data to calculate USD amounts
 * - Creates a new donation record with the allocated amount
 * - Links the donation to both the application and round
 */
export class DVMDAllocatedHandler implements IEventHandler<"Strategy", "AllocatedWithOrigin"> {
    constructor(
        readonly event: ProcessorEvent<"Strategy", "AllocatedWithOrigin">,
        private readonly chainId: ChainId,
        private readonly dependencies: Dependencies,
    ) {}

    /**
     * Handles the AllocatedWithOrigin event for the Donation Voting Merkle Distribution Direct Transfer strategy.
     * @returns {Changeset[]} The changeset containing an InsertDonation change
     * @throws {OriginMissing} if the origin is missing
     * @throws {RoundNotFound} if the round does not exist
     * @throws {ApplicationNotFound} if the application does not exist
     * @throws {UnknownToken} if the token does not exist
     * @throws {TokenPriceNotFoundError} if the token price is not found
     * @throws {MetadataParsingFailed} if the metadata is invalid
     */
    async handle(): Promise<Changeset[]> {
        const startTime = performance.now();
        const { roundRepository, applicationRepository } = this.dependencies;
        const { srcAddress } = this.event;
        const { recipientId: _recipientId, amount: strAmount, token: _token } = this.event.params;

        const amount = BigInt(strAmount);

        // Time round lookup
        const roundLookupStart = performance.now();
        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(srcAddress),
        );
        const roundLookupTime = performance.now() - roundLookupStart;
        console.log(`[AllocatedWithOrigin] Round lookup took ${roundLookupTime.toFixed(2)}ms`);

        // Time application lookup
        const appLookupStart = performance.now();
        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            getAddress(_recipientId),
        );
        const appLookupTime = performance.now() - appLookupStart;
        console.log(`[AllocatedWithOrigin] Application lookup took ${appLookupTime.toFixed(2)}ms`);

        const donationId = getDonationId(this.event.blockNumber, this.event.logIndex);

        // Time token validation
        const tokenValidationStart = performance.now();
        const token = getTokenOrThrow(this.chainId, _token);
        const matchToken = getTokenOrThrow(this.chainId, round.matchTokenAddress);
        const tokenValidationTime = performance.now() - tokenValidationStart;
        console.log(
            `[AllocatedWithOrigin] Token validation took ${tokenValidationTime.toFixed(2)}ms`,
        );

        // Time price calculations
        const priceCalcStart = performance.now();
        const { amountInUsd } = await getTokenAmountInUsd(
            this.dependencies.pricingProvider,
            token,
            amount,
            this.event.blockTimestamp,
        );
        let amountInRoundMatchToken: bigint | null = null;
        amountInRoundMatchToken =
            matchToken.address === token.address
                ? amount
                : (
                      await getUsdInTokenAmount(
                          this.dependencies.pricingProvider,
                          matchToken,
                          amountInUsd,
                          this.event.blockTimestamp,
                      )
                  ).amount;
        const priceCalcTime = performance.now() - priceCalcStart;
        console.log(`[AllocatedWithOrigin] Price calculations took ${priceCalcTime.toFixed(2)}ms`);

        // Time metadata parsing
        const metadataStart = performance.now();
        const parsedMetadata = this.parseMetadataOrThrow(application.metadata);
        const metadataTime = performance.now() - metadataStart;
        console.log(`[AllocatedWithOrigin] Metadata parsing took ${metadataTime.toFixed(2)}ms`);

        const donation: Donation = {
            id: donationId,
            chainId: this.chainId,
            roundId: round.id,
            applicationId: application.id,
            donorAddress: getAddress(this.event.params.origin),
            recipientAddress: getAddress(parsedMetadata.application.recipient),
            projectId: application.projectId,
            transactionHash: this.event.transactionFields.hash,
            blockNumber: BigInt(this.event.blockNumber),
            tokenAddress: token.address,
            amount: amount,
            amountInUsd,
            amountInRoundMatchToken,
            timestamp: new Date(this.event.blockTimestamp),
        };

        const totalTime = performance.now() - startTime;
        console.log(`[AllocatedWithOrigin] Total processing time: ${totalTime.toFixed(2)}ms`);

        return [
            {
                type: "InsertDonation",
                args: { donation },
            },
            {
                type: "IncrementRoundDonationStats",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amountInUsd,
                },
            },
            {
                type: "IncrementApplicationDonationStats",
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    applicationId: application.id,
                    amountInUsd,
                },
            },
        ];
    }

    /**
     * Parses the application metadata.
     * @param {unknown} metadata - The metadata to parse.
     * @returns {ApplicationMetadata} The parsed metadata.
     * @throws {MetadataParsingFailed} if the metadata is invalid.
     */
    private parseMetadataOrThrow(metadata: unknown): ApplicationMetadata {
        const parsedMetadata = ApplicationMetadataSchema.safeParse(metadata);
        if (!parsedMetadata.success) throw new MetadataParsingFailed(parsedMetadata.error.message);

        return parsedMetadata.data;
    }
}
