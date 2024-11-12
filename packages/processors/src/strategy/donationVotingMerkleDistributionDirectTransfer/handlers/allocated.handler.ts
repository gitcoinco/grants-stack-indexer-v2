import { Address, encodePacked, getAddress, keccak256 } from "viem";

import { Application, Changeset, Donation, Round } from "@grants-stack-indexer/repository";
import { ChainId, getToken, ProcessorEvent, Token } from "@grants-stack-indexer/shared";

import { getTokenAmountInUsd, getUsdInTokenAmount } from "../../../helpers/index.js";
import {
    ApplicationNotFound,
    IEventHandler,
    MetadataParsingFailed,
    ProcessorDependencies,
    RoundNotFound,
    UnknownToken,
} from "../../../internal.js";
import { ApplicationMetadata, ApplicationMetadataSchema } from "../../../schemas/index.js";

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
        const { srcAddress } = this.event;
        const { recipientId: _recipientId, amount, token: _token } = this.event.params;

        const round = await this.getRoundOrThrow(srcAddress);
        const application = await this.getApplicationOrThrow(round.id, _recipientId);

        const donationId = this.getDonationId(this.event.blockNumber, this.event.logIndex);

        const token = this.getTokenOrThrow(_token);
        const matchToken = this.getTokenOrThrow(round.matchTokenAddress);

        const { amountInUsd, timestamp: priceTimestamp } = await getTokenAmountInUsd(
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

        const parsedMetadata = this.parseMetadataOrThrow(application.metadata);

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
            timestamp: new Date(priceTimestamp), //TODO: ask Gitcoin if this is correct
        };

        return [
            {
                type: "InsertDonation",
                args: { donation },
            },
        ];
    }

    /**
     * Retrieves a round by its strategy address.
     * @param {Address} strategyAddress - The address of the strategy.
     * @returns {Promise<Round>} The round found.
     * @throws {RoundNotFound} if the round does not exist.
     */
    private async getRoundOrThrow(strategyAddress: Address): Promise<Round> {
        const normalizedStrategyAddress = getAddress(strategyAddress);
        const round = await this.dependencies.roundRepository.getRoundByStrategyAddress(
            this.chainId,
            normalizedStrategyAddress,
        );

        if (!round) {
            throw new RoundNotFound(this.chainId, normalizedStrategyAddress);
        }

        return round;
    }

    /**
     * Retrieves an application by its round ID and recipient address.
     * @param {string} roundId - The ID of the round.
     * @param {Address} recipientId - The address of the recipient.
     * @returns {Promise<Application>} The application found.
     * @throws {ApplicationNotFound} if the application does not exist.
     */
    private async getApplicationOrThrow(
        roundId: string,
        recipientId: Address,
    ): Promise<Application> {
        const normalizedRecipientId = getAddress(recipientId);
        const application =
            await this.dependencies.applicationRepository.getApplicationByAnchorAddress(
                this.chainId,
                roundId,
                normalizedRecipientId,
            );

        if (!application) {
            throw new ApplicationNotFound(this.chainId, roundId, normalizedRecipientId);
        }

        return application;
    }

    /**
     * DONATION_ID = keccak256(abi.encodePacked(blockNumber, "-", logIndex));
     */
    private getDonationId(blockNumber: number, logIndex: number): string {
        return keccak256(encodePacked(["string"], [`${blockNumber}-${logIndex}`]));
    }

    /**
     * Retrieves a token by its address and chain ID.
     * @param {Address} tokenAddress - The address of the token.
     * @returns {Token} The token found.
     * @throws {UnknownToken} if the token does not exist.
     */
    private getTokenOrThrow(tokenAddress: Address): Token {
        const token = getToken(this.chainId, getAddress(tokenAddress));
        if (!token) throw new UnknownToken(tokenAddress, this.chainId);
        return token;
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
