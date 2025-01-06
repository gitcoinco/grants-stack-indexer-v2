import { AbiParameter } from "abitype";
import {
    Abi,
    Address,
    Chain,
    ContractConstructorArgs,
    ContractFunctionArgs,
    ContractFunctionName,
    ContractFunctionParameters,
    ContractFunctionReturnType,
    createPublicClient,
    decodeAbiParameters,
    DecodeAbiParametersReturnType,
    encodeDeployData,
    EstimateGasParameters,
    fallback,
    FallbackTransport,
    GetBlockReturnType,
    GetTransactionReturnType,
    Hex,
    http,
    HttpTransport,
    MulticallParameters,
    MulticallReturnType,
    RpcError,
    TimeoutError,
    toHex,
} from "viem";

import { ILogger, NonRetriableError, RetriableError } from "@grants-stack-indexer/shared";

import {
    AbiWithConstructor,
    DataDecodeException,
    InvalidArgumentException,
    MulticallNotFound,
    RpcUrlsEmpty,
} from "../internal.js";

/**
 * Acts as a wrapper around Viem library to provide methods to interact with an EVM-based blockchain.
 */
export class EvmProvider {
    private client: ReturnType<
        typeof createPublicClient<FallbackTransport<HttpTransport[]>, Chain | undefined>
    >;

    constructor(
        rpcUrls: string[],
        readonly chain: Chain | undefined,
        private readonly logger: ILogger,
    ) {
        if (rpcUrls.length === 0) {
            throw new RpcUrlsEmpty();
        }

        this.client = createPublicClient({
            chain,
            transport: fallback(rpcUrls.map((rpcUrl) => http(rpcUrl))),
        });
    }

    /**
     * Retrieves the address of the Multicall3 contract.
     * @returns {Address | undefined} The address of the Multicall3 contract, or undefined if not found.
     */
    getMulticall3Address(): Address | undefined {
        return this.chain?.contracts?.multicall3?.address;
    }

    async getTransaction(hash: Hex): Promise<GetTransactionReturnType> {
        try {
            return await this.client.getTransaction({ hash });
        } catch (e) {
            throw this.wrapError(e, "getTransaction", "Failed to get transaction", { hash });
        }
    }

    /**
     * Retrieves the balance of the specified address.
     * @param {Address} address The address for which to retrieve the balance.
     * @returns {Promise<bigint>} A Promise that resolves to the balance of the address.
     */
    async getBalance(address: Address): Promise<bigint> {
        try {
            return await this.client.getBalance({ address });
        } catch (e) {
            throw this.wrapError(e, "getBalance", "Failed to get balance", { address });
        }
    }

    /**
     * Retrieves the current block number.
     * @returns {Promise<bigint>} A Promise that resolves to the latest block number.
     */
    async getBlockNumber(): Promise<bigint> {
        try {
            return await this.client.getBlockNumber();
        } catch (e) {
            throw this.wrapError(e, "getBlockNumber", "Failed to get block number");
        }
    }

    /**
     * Retrieves the current block number.
     * @returns {Promise<GetBlockReturnType>} Latest block number.
     */
    async getBlockByNumber(blockNumber: bigint): Promise<GetBlockReturnType> {
        try {
            return await this.client.getBlock({ blockNumber });
        } catch (e) {
            throw this.wrapError(e, "getBlockByNumber", "Failed to get block", {
                blockNumber: blockNumber.toString(),
            });
        }
    }

    /**
     * Retrieves the current estimated gas price on the chain.
     * @returns {Promise<bigint>} A Promise that resolves to the current gas price.
     */
    async getGasPrice(): Promise<bigint> {
        try {
            return await this.client.getGasPrice();
        } catch (e) {
            throw this.wrapError(e, "getGasPrice", "Failed to get gas price");
        }
    }

    async estimateGas(args: EstimateGasParameters<typeof this.chain>): Promise<bigint> {
        try {
            return await this.client.estimateGas(args);
        } catch (e) {
            throw this.wrapError(e, "estimateGas", "Failed to estimate gas", args);
        }
    }

    /**
     * Retrieves the value from a storage slot at a given address.
     * @param {Address} address The address of the contract.
     * @param {number} slot The slot number to read.
     * @returns {Promise<Hex>} A Promise that resolves to the value of the storage slot.
     * @throws {InvalidArgumentException} If the slot is not a positive integer.
     */
    async getStorageAt(address: Address, slot: number | Hex): Promise<Hex | undefined> {
        if (typeof slot === "number" && (slot <= 0 || !Number.isInteger(slot))) {
            throw new InvalidArgumentException(
                `Slot must be a positive integer number. Received: ${slot}`,
            );
        }

        try {
            return await this.client.getStorageAt({
                address,
                slot: typeof slot === "string" ? slot : toHex(slot),
            });
        } catch (e) {
            throw this.wrapError(e, "getStorageAt", "Failed to get storage", { address, slot });
        }
    }

    /**
     * Reads a contract "pure" or "view" function with the specified arguments using readContract from Viem.
     * @param {Address} contractAddress - The address of the contract.
     * @param {TAbi} abi - The ABI (Application Binary Interface) of the contract.
     * @param {TFunctionName} functionName - The name of the function to call.
     * @param {TArgs} [args] - The arguments to pass to the function (optional).
     * @returns A promise that resolves to the return value of the contract function.
     */
    async readContract<
        TAbi extends Abi,
        TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
        TArgs extends ContractFunctionArgs<TAbi, "pure" | "view", TFunctionName>,
    >(
        contractAddress: Address,
        abi: TAbi,
        functionName: TFunctionName,
        args?: TArgs,
    ): Promise<ContractFunctionReturnType<TAbi, "pure" | "view", TFunctionName, TArgs>> {
        try {
            return await this.client.readContract({
                address: contractAddress,
                abi,
                functionName,
                args,
            });
        } catch (e) {
            throw this.wrapError(e, "readContract", "Failed to read contract", {
                contractAddress,
                functionName,
                args,
            });
        }
    }

    /**
     * Executes a batch request to deploy a contract and returns the decoded constructor return parameters.
     * @param {AbiWithConstructor} abi - The ABI (Application Binary Interface) of the contract. Must contain a constructor.
     * @param {Hex} bytecode - The bytecode of the contract.
     * @param {ContractConstructorArgs<typeof abi>} args - The constructor arguments for the contract.
     * @param constructorReturnParams - The return parameters of the contract's constructor.
     * @returns The decoded constructor return parameters.
     * @throws {DataDecodeException} if there is no return data or if the return data does not match the expected type.
     */
    async batchRequest<ReturnType extends readonly AbiParameter[]>(
        abi: AbiWithConstructor,
        bytecode: Hex,
        args: ContractConstructorArgs<typeof abi>,
        constructorReturnParams: ReturnType,
    ): Promise<DecodeAbiParametersReturnType<ReturnType>> {
        const deploymentData = args ? encodeDeployData({ abi, bytecode, args }) : bytecode;

        try {
            const { data: returnData } = await this.client.call({
                data: deploymentData,
            });

            if (!returnData) {
                throw new DataDecodeException("No return data");
            }

            try {
                return decodeAbiParameters(constructorReturnParams, returnData);
            } catch (e) {
                throw new DataDecodeException(
                    "Error decoding return data with given AbiParameters",
                );
            }
        } catch (e) {
            if (e instanceof DataDecodeException) {
                throw e;
            }
            throw this.wrapError(e, "batchRequest", "Failed to execute batch request", { args });
        }
    }

    /**
     * Similar to readContract, but batches up multiple functions
     * on a contract in a single RPC call via the multicall3 contract.
     * @param {MulticallParameters} args - The parameters for the multicall.
     * @returns — An array of results. If allowFailure is true, with accompanying status
     * @throws {MulticallNotFound} if the Multicall contract is not found.
     */
    async multicall<
        contracts extends readonly unknown[] = readonly ContractFunctionParameters[],
        allowFailure extends boolean = true,
    >(
        args: MulticallParameters<contracts, allowFailure>,
    ): Promise<MulticallReturnType<contracts, allowFailure>> {
        if (!this.chain?.contracts?.multicall3?.address) throw new MulticallNotFound();

        try {
            return await this.client.multicall<contracts, allowFailure>(args);
        } catch (e) {
            throw this.wrapError(e, "multicall", "Failed to execute multicall", { args });
        }
    }

    private wrapError(
        error: unknown,
        methodName: Exclude<
            keyof typeof EvmProvider.prototype,
            "constructor" | "wrapError" | "logger" | "chain" | "client"
        >,
        errorMessage: string,
        additionalData?: Record<string, unknown>,
    ): RetriableError | NonRetriableError {
        const err = error as Error;
        if (err instanceof TimeoutError || err instanceof RpcError) {
            return new RetriableError(errorMessage, {
                className: EvmProvider.name,
                methodName,
                chainId: this.chain?.id?.toString(),
                additionalData,
            });
        }
        return new NonRetriableError(
            err.message,
            {
                className: "EvmProvider",
                methodName,
                chainId: this.chain?.id?.toString(),
                additionalData,
            },
            err,
        );
    }
}
