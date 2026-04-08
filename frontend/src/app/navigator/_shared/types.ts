"use client"; // Putting this at the top level so it'll propagate all the way down for simplicity

// MARK: - Networking

export type SWRResponse<T> = { response: T | undefined; error: Error | undefined; isLoading: boolean };
