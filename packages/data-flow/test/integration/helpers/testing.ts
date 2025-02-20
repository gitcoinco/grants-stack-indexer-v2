import { MockInstance, vi } from "vitest";

export const waitForProcessing = async (
    eventsFetcherSpy: MockInstance,
    dataLoaderSpy: MockInstance,
): Promise<void> => {
    await vi.waitFor(
        () => {
            if (eventsFetcherSpy.mock.calls.length < 2) throw new Error("Not yet called");
            if (dataLoaderSpy.mock.calls.length < 1) throw new Error("Not yet called");
        },
        {
            timeout: 500,
            interval: 50,
        },
    );
};
