export type HasuraConfig = {
    endpoint: string;
    adminSecret: string;
    schema: string;
    fetchLimit: number;
};

export type ManualConfiguration<Tables extends readonly string[]> = {
    remote_table: {
        name: Tables[number];
        schema: string;
    };
    source: string;
    column_mapping: Record<string, string>;
};

export type RelationshipConfig<Tables extends readonly string[]> = {
    name: string;
    table: {
        name: Tables[number];
        schema: string;
    };
    using: {
        manual_configuration: ManualConfiguration<Tables>;
    };
    source: string;
};

export type CustomFunction = {
    name: string;
    schema: string;
};
