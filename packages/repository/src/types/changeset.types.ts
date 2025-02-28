import type { Address, ChainId } from "@grants-stack-indexer/shared";

import {
    AttestationTxnData,
    NewApplication,
    NewApplicationPayout,
    NewAttestation,
    NewDonation,
    NewLegacyProject,
    NewPendingProjectRole,
    NewPendingRoundRole,
    NewProcessedEvent,
    NewProject,
    NewProjectRole,
    NewRound,
    NewRoundRole,
    PartialApplication,
    PartialProject,
    PartialRound,
    ProjectRole,
    RoundRole,
} from "./index.js";

//TODO: see if in the future we move out of inline object types for changesets

export type ProjectChangeset =
    | {
          type: "InsertProject";
          args: {
              project: NewProject;
          };
      }
    | {
          type: "UpdateProject";
          args: {
              chainId: ChainId;
              projectId: string;
              project: PartialProject;
          };
      }
    | {
          type: "InsertPendingProjectRole";
          args: {
              pendingProjectRole: NewPendingProjectRole;
          };
      }
    | {
          type: "DeletePendingProjectRoles";
          args: {
              ids: number[];
          };
      }
    | {
          type: "InsertProjectRole";
          args: {
              projectRole: NewProjectRole;
          };
      }
    | {
          type: "DeleteAllProjectRolesByRole";
          args: {
              projectRole: Pick<ProjectRole, "chainId" | "projectId" | "role">;
          };
      }
    | {
          type: "DeleteAllProjectRolesByRoleAndAddress";
          args: {
              projectRole: Pick<ProjectRole, "chainId" | "projectId" | "role" | "address">;
          };
      };

export type RoundChangeset =
    | {
          type: "InsertRound";
          args: {
              round: NewRound;
          };
      }
    | {
          type: "UpdateRound";
          args: {
              chainId: ChainId;
              roundId: string;
              round: PartialRound;
          };
      }
    | {
          type: "UpdateRoundByStrategyAddress";
          args: {
              chainId: ChainId;
              strategyAddress: Address;
              round: PartialRound;
          };
      }
    | {
          type: "IncrementRoundFundedAmount";
          args: {
              chainId: ChainId;
              roundId: string;
              fundedAmount: bigint;
              fundedAmountInUsd: string;
          };
      }
    | {
          type: "IncrementRoundTotalDistributed";
          args: {
              chainId: ChainId;
              roundId: string;
              amount: bigint;
          };
      }
    | {
          type: "InsertPendingRoundRole";
          args: {
              pendingRoundRole: NewPendingRoundRole;
          };
      }
    | {
          type: "DeletePendingRoundRoles";
          args: {
              ids: number[];
          };
      }
    | {
          type: "InsertRoundRole";
          args: {
              roundRole: NewRoundRole;
          };
      }
    | {
          type: "DeleteAllRoundRolesByRoleAndAddress";
          args: {
              roundRole: Pick<RoundRole, "chainId" | "roundId" | "role" | "address">;
          };
      };

export type ApplicationChangeset =
    | {
          type: "InsertApplication";
          args: NewApplication;
      }
    | {
          type: "UpdateApplication";
          args: {
              chainId: ChainId;
              roundId: string;
              applicationId: string;
              application: PartialApplication;
          };
      };

export type DonationChangeset =
    | {
          type: "InsertDonation";
          args: {
              donation: NewDonation;
          };
      }
    | {
          type: "InsertManyDonations";
          args: {
              donations: NewDonation[];
          };
      };

export type ApplicationPayoutChangeset = {
    type: "InsertApplicationPayout";
    args: {
        applicationPayout: NewApplicationPayout;
    };
};

export type ProcessedEventChangeset = {
    type: "InsertProcessedEvent";
    args: {
        chainId: ChainId;
        processedEvent: NewProcessedEvent;
    };
};

export type LegacyProjectChangeset = {
    type: "InsertLegacyProject";
    args: {
        legacyProject: NewLegacyProject;
    };
};

export type AttestationChangeset = {
    type: "InsertAttestation";
    args: {
        attestationData: NewAttestation;
        transactionsData: AttestationTxnData[];
    };
};

export type Changeset =
    | ProjectChangeset
    | RoundChangeset
    | ApplicationChangeset
    | DonationChangeset
    | ApplicationPayoutChangeset
    | ProcessedEventChangeset
    | LegacyProjectChangeset
    | AttestationChangeset;
