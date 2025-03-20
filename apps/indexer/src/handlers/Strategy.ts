/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Strategy } from "../../generated";

// Registered Handlers
Strategy.RegisteredWithSender.handler(async ({}) => {});
Strategy.RegisteredWithData.handler(async ({}) => {});

// TimestampsUpdated Handlers
Strategy.TimestampsUpdated.handler(async ({}) => {});
Strategy.TimestampsUpdatedWithRegistrationAndAllocation.handler(async ({}) => {});

// DistributionUpdated Handler
Strategy.DistributionUpdated.handler(async ({}) => {});
Strategy.DistributionUpdatedWithMerkleRoot.handler(async ({}) => {});

// FundsDistributed Handler
Strategy.FundsDistributed.handler(async ({}) => {});

// Distributed Handlers
Strategy.DistributedWithRecipientAddress.handler(async ({}) => {});
Strategy.DistributedWithData.handler(async ({}) => {});
Strategy.DistributedWithFlowRate.handler(async ({}) => {});

// Allocated Handlers
Strategy.AllocatedWithOrigin.handler(async ({}) => {});
Strategy.AllocatedWithData.handler(async ({}) => {});
Strategy.AllocatedWithToken.handler(async ({}) => {});
Strategy.AllocatedWithVotes.handler(async ({}) => {});
Strategy.AllocatedWithStatus.handler(async ({}) => {});

// AllocatedWithNft Handler
Strategy.AllocatedWithNft.handler(async ({}) => {});

// DirectAllocated Handler
Strategy.DirectAllocated.handler(async ({}) => {});

// RecipientStatusUpdated Handlers
Strategy.RecipientStatusUpdatedWithApplicationId.handler(async ({}) => {});
Strategy.RecipientStatusUpdatedWithRecipientStatus.handler(async ({}) => {});
Strategy.RecipientStatusUpdatedWithFullRow.handler(async ({}) => {});

// UpdatedRegistration Handlers
Strategy.UpdatedRegistrationWithStatus.handler(async ({}) => {});
Strategy.UpdatedRegistration.handler(async ({}) => {});
Strategy.UpdatedRegistrationWithApplicationId.handler(async ({}) => {});
