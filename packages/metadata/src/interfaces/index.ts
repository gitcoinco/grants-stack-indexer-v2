export * from "./metadata.interface.js";

export type MetadataProvider = "pinata" | "public-gateway" | "dummy";

export type DummyMetadataConfig = {
    metadataSource: "dummy";
};

export type GatewayMetadataConfig = {
    metadataSource: "public-gateway";
    gateways: string[];
};

export type PinataMetadataConfig = {
    metadataSource: "pinata";
    jwt: string;
    gateway: string;
};

export type MetadataConfig<Source extends MetadataProvider> = Source extends "dummy"
    ? DummyMetadataConfig
    : Source extends "public-gateway"
      ? GatewayMetadataConfig
      : Source extends "pinata"
        ? PinataMetadataConfig
        : never;
