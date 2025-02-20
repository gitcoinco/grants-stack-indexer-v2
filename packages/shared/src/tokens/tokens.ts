import { Branded } from "viem";

import { Address, ChainId, TimestampMs } from "../internal.js";

export type TokenCode = Branded<string, "TokenCode">;

export type Token = {
    code: TokenCode;
    priceSourceCode: TokenCode;
    address: Address;
    decimals: number;
    voteAmountCap?: bigint;
};

export type TokenPrice = {
    timestampMs: TimestampMs;
    priceUsd: number;
};

export type TokensMap = {
    [chainId: number]: {
        [tokenAddress: Address]: Token;
    };
};

export const extractAllPriceSourceCodes = (tokensMap: TokensMap): TokenCode[] => {
    const priceSourceCodes = new Set<TokenCode>();

    Object.values(tokensMap).forEach((chainTokens) => {
        Object.values(chainTokens).forEach((token) => {
            priceSourceCodes.add(token.priceSourceCode);
        });
    });

    return Array.from(priceSourceCodes);
};

export const TOKENS: {
    [chainId: number]: {
        [tokenAddress: Address]: Token;
    };
} = {
    "1": {
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
        },
        "0x6B175474E89094C44Da98b954EedeAC495271d0F": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            decimals: 18,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x661c70333AA1850CcDBAe82776Bb436A0fCfeEfB": {
            code: "eBTC" as TokenCode,
            priceSourceCode: "eBTC" as TokenCode,
            address: "0x661c70333AA1850CcDBAe82776Bb436A0fCfeEfB",
            decimals: 18,
        },
    },
    "10": {
        "0x7F5c764cBc14f9669B88837ca1490cCa17c31607": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
            decimals: 6,
        },
        "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            decimals: 18,
        },
        "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": {
            code: "USDGLO" as TokenCode,
            priceSourceCode: "USDGLO" as TokenCode,
            address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
            decimals: 18,
        },
        "0x93A5347036f69BC6f37Ed2b59CBcDDa927719217": {
            code: "GIST" as TokenCode,
            priceSourceCode: "GIST" as TokenCode,
            address: "0x93A5347036f69BC6f37Ed2b59CBcDDa927719217",
            decimals: 18,
            voteAmountCap: 10000000000000000000n,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x4200000000000000000000000000000000000042": {
            code: "OP" as TokenCode,
            priceSourceCode: "OP" as TokenCode,
            address: "0x4200000000000000000000000000000000000042",
            decimals: 18,
        },
    },
    "42": {
        "0x0000000000000000000000000000000000000000": {
            code: "LYX" as TokenCode,
            priceSourceCode: "LYX" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "LYX" as TokenCode,
            priceSourceCode: "LYX" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x2dB41674F2b882889e5E1Bd09a3f3613952bC472": {
            code: "WLYX" as TokenCode,
            priceSourceCode: "WLYX" as TokenCode,
            address: "0x2dB41674F2b882889e5E1Bd09a3f3613952bC472",
            decimals: 18,
        },
    },
    "100": {
        "0x0000000000000000000000000000000000000000": {
            code: "XDAI" as TokenCode,
            priceSourceCode: "XDAI" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "XDAI" as TokenCode,
            priceSourceCode: "XDAI" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83",
            decimals: 6,
        },
    },
    "137": {
        "0x0000000000000000000000000000000000000000": {
            code: "MATIC" as TokenCode,
            priceSourceCode: "MATIC" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "MATIC" as TokenCode,
            priceSourceCode: "MATIC" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            decimals: 6,
        },
        "0x3a9A81d576d83FF21f26f325066054540720fC34": {
            code: "DATA" as TokenCode,
            priceSourceCode: "DATA" as TokenCode,
            address: "0x3a9A81d576d83FF21f26f325066054540720fC34",
            decimals: 18,
        },
        "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": {
            code: "USDGLO" as TokenCode,
            priceSourceCode: "USDGLO" as TokenCode,
            address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
            decimals: 18,
        },
    },
    "250": {
        "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
            decimals: 6,
        },
        "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E",
            decimals: 18,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "FTM" as TokenCode,
            priceSourceCode: "FTM" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "FTM" as TokenCode,
            priceSourceCode: "FTM" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x83791638da5EB2fAa432aff1c65fbA47c5D29510": {
            code: "GcV" as TokenCode,
            priceSourceCode: "GcV" as TokenCode,
            address: "0x83791638da5EB2fAa432aff1c65fbA47c5D29510",
            decimals: 18,
            voteAmountCap: 10000000000000000000n,
        },
    },
    "300": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
    },
    "324": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4",
            decimals: 6,
        },
        "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C": {
            code: "USDT" as TokenCode,
            priceSourceCode: "USDT" as TokenCode,
            address: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C",
            decimals: 6,
        },
        "0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656",
            decimals: 18,
        },
        "0x503234F203fC7Eb888EEC8513210612a43Cf6115": {
            code: "LUSD" as TokenCode,
            priceSourceCode: "LUSD" as TokenCode,
            address: "0x503234F203fC7Eb888EEC8513210612a43Cf6115",
            decimals: 18,
        },
        "0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42": {
            code: "MUTE" as TokenCode,
            priceSourceCode: "MUTE" as TokenCode,
            address: "0x0e97C7a0F8B2C9885C8ac9fC6136e829CbC21d42",
            decimals: 18,
        },
    },
    "424": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2": {
            code: "GTC" as TokenCode,
            priceSourceCode: "GTC" as TokenCode,
            address: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2",
            decimals: 18,
        },
        "0x6C121674ba6736644A7e73A8741407fE8a5eE5BA": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x6C121674ba6736644A7e73A8741407fE8a5eE5BA",
            decimals: 18,
        },
    },
    "1088": {
        "0x0000000000000000000000000000000000000000": {
            code: "METIS" as TokenCode,
            priceSourceCode: "METIS" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "METIS" as TokenCode,
            priceSourceCode: "METIS" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
    },
    "1329": {
        "0x0000000000000000000000000000000000000000": {
            code: "SEI" as TokenCode,
            priceSourceCode: "SEI" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "SEI" as TokenCode,
            priceSourceCode: "SEI" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1",
            decimals: 6,
        },
    },
    "4201": {
        "0x0000000000000000000000000000000000000000": {
            code: "LYX" as TokenCode,
            priceSourceCode: "LYX" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "LYX" as TokenCode,
            priceSourceCode: "LYX" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
    },
    "8453": {
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimals: 6,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
    },
    "42161": {
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            decimals: 6,
        },
        "0x912CE59144191C1204E64559FE8253a0e49E6548": {
            code: "ARB" as TokenCode,
            priceSourceCode: "ARB" as TokenCode,
            address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
            decimals: 18,
        },
        "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": {
            code: "USDGLO" as TokenCode,
            priceSourceCode: "USDGLO" as TokenCode,
            address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3",
            decimals: 18,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x7f9a7db853ca816b9a138aee3380ef34c437dee0": {
            code: "GTC" as TokenCode,
            priceSourceCode: "GTC" as TokenCode,
            address: "0x7f9a7db853ca816b9a138aee3380ef34c437dee0",
            decimals: 18,
        },
    },
    "42220": {
        "0x0000000000000000000000000000000000000000": {
            code: "CELO" as TokenCode,
            priceSourceCode: "CELO" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "CELO" as TokenCode,
            priceSourceCode: "CELO" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x765de816845861e75a25fca122bb6898b8b1282a": {
            code: "CUSD" as TokenCode,
            priceSourceCode: "CUSD" as TokenCode,
            address: "0x765de816845861e75a25fca122bb6898b8b1282a",
            decimals: 18,
        },
        "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": {
            code: "USDGLO" as TokenCode,
            priceSourceCode: "USDGLO" as TokenCode,
            address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3",
            decimals: 18,
        },
    },
    "43113": {
        "0x0000000000000000000000000000000000000000": {
            code: "AVAX" as TokenCode,
            priceSourceCode: "AVAX" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "AVAX" as TokenCode,
            priceSourceCode: "AVAX" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
            decimals: 6,
        },
    },
    "43114": {
        "0x0000000000000000000000000000000000000000": {
            code: "AVAX" as TokenCode,
            priceSourceCode: "AVAX" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "AVAX" as TokenCode,
            priceSourceCode: "AVAX" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
            decimals: 6,
        },
    },
    "44787": {
        "0x0000000000000000000000000000000000000000": {
            code: "CELO" as TokenCode,
            priceSourceCode: "CELO" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "CELO" as TokenCode,
            priceSourceCode: "CELO" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
    },
    "58008": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x5fbdb2315678afecb367f032d93f642f64180aa3": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
            decimals: 18,
        },
    },
    "80001": {
        "0x0000000000000000000000000000000000000000": {
            code: "MATIC" as TokenCode,
            priceSourceCode: "MATIC" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "MATIC" as TokenCode,
            priceSourceCode: "MATIC" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97",
            decimals: 6,
        },
    },
    "534351": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0xc2332031de487f430fae3290c05465d907785eda": {
            code: "MTK" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0xc2332031de487f430fae3290c05465d907785eda",
            decimals: 18,
        },
    },
    "534352": {
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
            decimals: 6,
        },
    },
    "713715": {
        "0x0000000000000000000000000000000000000000": {
            code: "SEI" as TokenCode,
            priceSourceCode: "SEI" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "SEI" as TokenCode,
            priceSourceCode: "SEI" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x26841a0A5D958B128209F4ea9a1DD7E61558c330": {
            code: "WSEI" as TokenCode,
            priceSourceCode: "WSEI" as TokenCode,
            address: "0x26841a0A5D958B128209F4ea9a1DD7E61558c330",
            decimals: 18,
        },
    },
    "11155111": {
        "0x8db0F9eE54753B91ec1d81Bf68074Be82ED30fEb": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0x8db0F9eE54753B91ec1d81Bf68074Be82ED30fEb",
            decimals: 18,
        },
        "0xa9dd7983B57E1865024d27110bAB098B66087e8F": {
            code: "DAI" as TokenCode,
            priceSourceCode: "DAI" as TokenCode,
            address: "0xa9dd7983B57E1865024d27110bAB098B66087e8F",
            decimals: 18,
        },
        "0x0000000000000000000000000000000000000000": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 18,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "ETH" as TokenCode,
            priceSourceCode: "ETH" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 18,
        },
        "0x78e0D07C4A08adFfe610113310163b40E7e47e81": {
            code: "USDC" as TokenCode,
            priceSourceCode: "USDC" as TokenCode,
            address: "0x78e0D07C4A08adFfe610113310163b40E7e47e81",
            decimals: 6,
        },
    },
    "295": {
        "0x0000000000000000000000000000000000000000": {
            code: "HBAR" as TokenCode,
            priceSourceCode: "HBAR" as TokenCode,
            address: "0x0000000000000000000000000000000000000000",
            decimals: 8,
        },
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
            code: "HBAR" as TokenCode,
            priceSourceCode: "HBAR" as TokenCode,
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: 8,
        },
    },
} as const;

export const TOKENS_SOURCE_CODES = extractAllPriceSourceCodes(TOKENS);

export const getToken = (chainId: number, tokenAddress: Address): Token | undefined => {
    return TOKENS[chainId]?.[tokenAddress];
};

export class UnknownToken extends Error {
    constructor(tokenAddress: string, chainId?: ChainId) {
        super(`Unknown token: ${tokenAddress} ${chainId ? `on chain ${chainId}` : ""}`);
    }
}

export const getTokenOrThrow = (chainId: ChainId, tokenAddress: Address): Token => {
    const token = getToken(chainId, tokenAddress);
    if (!token) throw new UnknownToken(tokenAddress, chainId);
    return token;
};
