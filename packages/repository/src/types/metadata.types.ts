export type Metadata = {
    id: string;
    metadata: unknown;
    createdAt: Date;
};

export type NewMetadata = Omit<Metadata, "createdAt">;
export type PartialMetadata = Partial<Metadata>;
