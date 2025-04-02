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
    "roundRepository" | "applicationRepository" | "pricingProvider" | "logger"
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
    ) {
        this.dependencies.logger?.debug("Initializing DVMDAllocatedHandler", {
            className: "DVMDAllocatedHandler",
            chainId: this.chainId,
            strategyAddress: this.event.srcAddress,
            blockNumber: this.event.blockNumber,
            transactionHash: this.event.transactionFields.hash,
        });
    }

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
        const { roundRepository, applicationRepository, pricingProvider, logger } =
            this.dependencies;
        const { srcAddress } = this.event;
        const { recipientId: _recipientId, amount: strAmount, token: _token } = this.event.params;

        logger?.debug("Starting allocation handling", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            recipientId: _recipientId,
            amount: strAmount,
            token: _token,
        });

        const amount = BigInt(strAmount);

        logger?.debug("Fetching round by strategy address", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            strategyAddress: srcAddress,
            chainId: this.chainId,
        });

        const round = await roundRepository.getRoundByStrategyAddressOrThrow(
            this.chainId,
            getAddress(srcAddress),
        );

        logger?.debug("Fetching application details", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            roundId: round.id,
            recipientId: _recipientId,
        });

        const application = await applicationRepository.getApplicationByAnchorAddressOrThrow(
            this.chainId,
            round.id,
            getAddress(_recipientId),
        );

        const donationId = getDonationId(this.event.blockNumber, this.event.logIndex);
        const token = getTokenOrThrow(this.chainId, _token);
        const matchToken = getTokenOrThrow(this.chainId, round.matchTokenAddress);

        logger?.debug("Calculating USD amount for donation", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            donationId,
            amount: amount.toString(),
            token: token,
            matchToken: matchToken,
        });

        const { amountInUsd } = await getTokenAmountInUsd(
            pricingProvider,
            token,
            amount,
            this.event.blockTimestamp,
        );

        logger?.debug("Calculating match token amount", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            amountInUsd,
            matchToken: matchToken,
            usingDirectConversion: matchToken.address === token.address,
        });

        let amountInRoundMatchToken: bigint | null = null;
        amountInRoundMatchToken =
            matchToken.address === token.address
                ? amount
                : (
                      await getUsdInTokenAmount(
                          pricingProvider,
                          matchToken,
                          amountInUsd,
                          this.event.blockTimestamp,
                      )
                  ).amount;

        logger?.debug("Parsing application metadata", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            applicationId: application.id,
            metadataPresent: application.metadata !== null,
        });

        const parsedMetadata = this.parseMetadataOrThrow(application.metadata);

        logger?.debug("Creating donation record", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            donationId,
            applicationId: application.id,
            roundId: round.id,
            amount: amount.toString(),
            amountInUsd,
        });

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

        const changes = [
            {
                type: "InsertDonation" as const,
                args: { donation },
            },
            {
                type: "IncrementRoundDonationStats" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    amountInUsd,
                },
            },
            {
                type: "IncrementApplicationDonationStats" as const,
                args: {
                    chainId: this.chainId,
                    roundId: round.id,
                    applicationId: application.id,
                    amountInUsd,
                },
            },
        ];

        logger?.info("Allocation processing completed", {
            className: "DVMDAllocatedHandler",
            methodName: "handle",
            donationId,
            roundId: round.id,
            applicationId: application.id,
            amount: amount.toString(),
            amountInUsd,
            amountInRoundMatchToken: amountInRoundMatchToken?.toString(),
            changeCount: changes.length,
        });

        return changes;
    }

    /**
     * Parses the application metadata.
     * @param {unknown} metadata - The metadata to parse.
     * @returns {ApplicationMetadata} The parsed metadata.
     * @throws {MetadataParsingFailed} if the metadata is invalid.
     */
    private parseMetadataOrThrow(metadata: unknown): ApplicationMetadata {
        const { logger } = this.dependencies;

        logger?.debug("Parsing metadata", {
            className: "DVMDAllocatedHandler",
            methodName: "parseMetadataOrThrow",
            metadataPresent: metadata !== null,
        });

        const parsedMetadata = ApplicationMetadataSchema.safeParse(metadata);
        if (!parsedMetadata.success) {
            logger?.error("Failed to parse metadata", {
                className: "DVMDAllocatedHandler",
                methodName: "parseMetadataOrThrow",
                error: parsedMetadata.error.message,
            });
            throw new MetadataParsingFailed(parsedMetadata.error.message);
        }

        return parsedMetadata.data;
    }
}
