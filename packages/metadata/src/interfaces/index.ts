export * from "./metadata.interface.js";

export type MetadataProvider = "public-gateway" | "dummy";

export type DummyMetadataConfig = {
    metadataSource: "dummy";
};

export type GatewayMetadataConfig = {
    metadataSource: "public-gateway";
    gateways: string[];
};

export type MetadataConfig<Source extends MetadataProvider> = Source extends "dummy"
    ? DummyMetadataConfig
    : Source extends "public-gateway"
      ? GatewayMetadataConfig
      : never;
