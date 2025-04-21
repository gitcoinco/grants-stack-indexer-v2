// Add your external exports here
export type {
    IRoundRepository,
    IRoundReadRepository,
    IProjectRepository,
    IProjectReadRepository,
    IApplicationRepository,
    IApplicationReadRepository,
    IDonationRepository,
    IApplicationPayoutRepository,
    ILegacyProjectRepository,
    IStrategyRegistryRepository,
    IEventRegistryRepository,
    IStrategyProcessingCheckpointRepository,
    IAttestationRepository,
    DatabaseConfig,
} from "./internal.js";

export type {
    Project,
    ProjectType,
    ProjectRoleNames,
    NewProject,
    PartialProject,
    ProjectRole,
    PendingProjectRole,
} from "./types/index.js";

export type { Round, NewRound, PartialRound, RoundRole, PendingRoundRole } from "./types/index.js";

export type {
    ApplicationStatus,
    StatusSnapshot,
    Application,
    NewApplication,
    PartialApplication,
} from "./types/index.js";

export type { Donation, NewDonation } from "./types/index.js";

export type { LegacyProject, NewLegacyProject } from "./types/index.js";
export type { NewApplicationPayout, ApplicationPayout } from "./types/index.js";

export type {
    NewAttestation,
    Attestation,
    AttestationTxn,
    AttestationTxnData,
    NewAttestationTxn,
} from "./types/index.js";

export type { Strategy, NewStrategy } from "./types/index.js";
export type { ProcessedEvent, NewProcessedEvent } from "./types/index.js";

export type {
    Changeset,
    ProjectChangeset,
    RoundChangeset,
    ApplicationChangeset,
    DonationChangeset,
    ApplicationPayoutChangeset,
    ProcessedEventChangeset,
    AttestationChangeset,
    LegacyProjectChangeset,
} from "./types/index.js";

export {
    KyselyRoundRepository,
    KyselyProjectRepository,
    KyselyApplicationRepository,
    KyselyDonationRepository,
    KyselyApplicationPayoutRepository,
    KyselyStrategyRegistryRepository,
    KyselyEventRegistryRepository,
    KyselyStrategyProcessingCheckpointRepository,
    KyselyAttestationRepository,
    KyselyLegacyProjectRepository,
} from "./kysely/repositories/index.js";

export {
    RoundNotFound,
    RoundNotFoundForId,
    ApplicationNotFound,
    ProjectNotFound,
    ProjectByRoleNotFound,
} from "./internal.js";

export type { StrategyProcessingCheckpoint, NewStrategyProcessingCheckpoint } from "./internal.js";

export type { ITransactionManager, TransactionConnection } from "./internal.js";
export { KyselyTransactionManager } from "./internal.js";

export type { ICache } from "./internal.js";
export type { Metadata, NewMetadata, PartialMetadata } from "./internal.js";
export type { StrategyTimings, NewStrategyTimings, PartialStrategyTimings } from "./internal.js";
export type { Price, NewPrice, PartialPrice, PriceCacheKey, IPricingCache } from "./internal.js";
export {
    KyselyMetadataCache,
    KyselyPricingCache,
    InMemoryMetadataCache,
    InMemoryPricingCache,
    KyselyStrategyTimingsCache,
} from "./internal.js";

export { createKyselyPostgresDb as createKyselyDatabase } from "./internal.js";
